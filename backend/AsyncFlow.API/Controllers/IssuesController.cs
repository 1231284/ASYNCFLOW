using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsyncFlow.API.Filters;
using AsyncFlow.Core.DTOs;
using AsyncFlow.Core.Entities;
using AsyncFlow.Infrastructure.Data;

namespace AsyncFlow.API.Controllers
{
    [Authorize]
    [ApiController]
    public class IssuesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public IssuesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("api/projects/{projectId}/issues")]
        [ProjectAuthorize] // Any project member can view board
        public async Task<IActionResult> GetProjectIssues(Guid projectId, [FromQuery] string? search, [FromQuery] bool onlyMyIssues = false)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(userIdClaim, out Guid currentUserId);

            var query = _context.Issues
                .AsNoTracking()
                .Where(i => i.ProjectId == projectId)
                .Include(i => i.IssueType)
                .Include(i => i.Priority)
                .Include(i => i.Status)
                .Include(i => i.Reporter)
                .Include(i => i.Assignee)
                .AsQueryable();

            // Real-time search filter: substring matching on Summary or Description
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(i => 
                    i.Summary.ToLower().Contains(term) || 
                    (i.Description != null && i.Description.ToLower().Contains(term)));
            }

            // Assignee toggle filter: "Only My Issues"
            if (onlyMyIssues)
            {
                query = query.Where(i => i.AssigneeId == currentUserId);
            }

            var issues = await query
                .Select(i => new IssueResponse
                {
                    Id = i.Id,
                    SequentialKey = i.SequentialKey,
                    Summary = i.Summary,
                    Description = i.Description,
                    ProjectId = i.ProjectId,
                    IssueTypeId = i.IssueTypeId,
                    IssueType = i.IssueType.Name,
                    PriorityId = i.PriorityId,
                    Priority = i.Priority.Name,
                    StatusId = i.StatusId,
                    Status = i.Status.Name,
                    Reporter = new UserDTO
                    {
                        Id = i.Reporter.Id,
                        Name = i.Reporter.Name,
                        Email = i.Reporter.Email,
                        AvatarUrl = i.Reporter.AvatarUrl,
                        IsActive = i.Reporter.IsActive
                    },
                    Assignee = i.Assignee != null ? new UserDTO
                    {
                        Id = i.Assignee.Id,
                        Name = i.Assignee.Name,
                        Email = i.Assignee.Email,
                        AvatarUrl = i.Assignee.AvatarUrl,
                        IsActive = i.Assignee.IsActive
                    } : null,
                    CreatedAt = i.CreatedAt,
                    UpdatedAt = i.UpdatedAt
                })
                .OrderByDescending(i => i.CreatedAt)
                .ToListAsync();

            return Ok(issues);
        }

        [HttpGet("api/issues/{issueId}")]
        [ProjectAuthorize] // Resolves ProjectId from IssueId in ActionFilter
        public async Task<IActionResult> GetIssue(Guid issueId)
        {
            var issue = await _context.Issues
                .AsNoTracking()
                .Include(i => i.IssueType)
                .Include(i => i.Priority)
                .Include(i => i.Status)
                .Include(i => i.Reporter)
                .Include(i => i.Assignee)
                .FirstOrDefaultAsync(i => i.Id == issueId);

            if (issue == null)
            {
                return NotFound(new { message = "Issue not found." });
            }

            var response = new IssueResponse
            {
                Id = issue.Id,
                SequentialKey = issue.SequentialKey,
                Summary = issue.Summary,
                Description = issue.Description,
                ProjectId = issue.ProjectId,
                IssueTypeId = issue.IssueTypeId,
                IssueType = issue.IssueType.Name,
                PriorityId = issue.PriorityId,
                Priority = issue.Priority.Name,
                StatusId = issue.StatusId,
                Status = issue.Status.Name,
                Reporter = new UserDTO
                {
                    Id = issue.Reporter.Id,
                    Name = issue.Reporter.Name,
                    Email = issue.Reporter.Email,
                    AvatarUrl = issue.Reporter.AvatarUrl,
                    IsActive = issue.Reporter.IsActive
                },
                Assignee = issue.Assignee != null ? new UserDTO
                {
                    Id = issue.Assignee.Id,
                    Name = issue.Assignee.Name,
                    Email = issue.Assignee.Email,
                    AvatarUrl = issue.Assignee.AvatarUrl,
                    IsActive = issue.Assignee.IsActive
                } : null,
                CreatedAt = issue.CreatedAt,
                UpdatedAt = issue.UpdatedAt
            };

            return Ok(response);
        }

        [HttpPost("api/projects/{projectId}/issues")]
        [ProjectAuthorize] // Any project member can create issues
        public async Task<IActionResult> CreateIssue(Guid projectId, [FromBody] IssueCreateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Summary))
            {
                return BadRequest(new { message = "Issue Summary is required." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(userIdClaim, out Guid currentUserId);

            // Validations
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null)
            {
                return NotFound(new { message = "Project not found." });
            }

            if (!await _context.IssueTypes.AnyAsync(t => t.Id == request.IssueTypeId))
            {
                return BadRequest(new { message = "Invalid IssueType ID." });
            }

            if (!await _context.Priorities.AnyAsync(p => p.Id == request.PriorityId))
            {
                return BadRequest(new { message = "Invalid Priority ID." });
            }

            if (!await _context.TaskStatuses.AnyAsync(s => s.Id == request.StatusId))
            {
                return BadRequest(new { message = "Invalid Status ID." });
            }

            if (request.AssigneeId.HasValue)
            {
                var isAssigneeParticipant = await _context.ProjectParticipants
                    .AnyAsync(p => p.ProjectId == projectId && p.UserId == request.AssigneeId.Value);
                if (!isAssigneeParticipant)
                {
                    return BadRequest(new { message = "The assigned user must be a participant in the project." });
                }
            }

            // Transactional automatic sequential key generator
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Retrieve all keys to extract the numeric suffix. We parse in memory to find the true max
                var existingKeys = await _context.Issues
                    .Where(i => i.ProjectId == projectId)
                    .Select(i => i.SequentialKey)
                    .ToListAsync();

                var maxSuffix = 0;
                foreach (var k in existingKeys)
                {
                    var parts = k.Split('-');
                    if (parts.Length > 1 && int.TryParse(parts[1], out int num))
                    {
                        if (num > maxSuffix) maxSuffix = num;
                    }
                }

                var nextSuffix = maxSuffix + 1;
                var sequentialKey = $"{project.Acronym.ToUpper()}-{nextSuffix}";

                var issue = new Issue
                {
                    Id = Guid.NewGuid(),
                    SequentialKey = sequentialKey,
                    Summary = request.Summary.Trim(),
                    Description = request.Description?.Trim(),
                    ProjectId = projectId,
                    IssueTypeId = request.IssueTypeId,
                    PriorityId = request.PriorityId,
                    StatusId = request.StatusId,
                    ReporterId = currentUserId,
                    AssigneeId = request.AssigneeId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Issues.Add(issue);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Load navigation fields to return response
                var dbIssue = await _context.Issues
                    .Include(i => i.IssueType)
                    .Include(i => i.Priority)
                    .Include(i => i.Status)
                    .Include(i => i.Reporter)
                    .Include(i => i.Assignee)
                    .FirstAsync(i => i.Id == issue.Id);

                var response = new IssueResponse
                {
                    Id = dbIssue.Id,
                    SequentialKey = dbIssue.SequentialKey,
                    Summary = dbIssue.Summary,
                    Description = dbIssue.Description,
                    ProjectId = dbIssue.ProjectId,
                    IssueTypeId = dbIssue.IssueTypeId,
                    IssueType = dbIssue.IssueType.Name,
                    PriorityId = dbIssue.PriorityId,
                    Priority = dbIssue.Priority.Name,
                    StatusId = dbIssue.StatusId,
                    Status = dbIssue.Status.Name,
                    Reporter = new UserDTO
                    {
                        Id = dbIssue.Reporter.Id,
                        Name = dbIssue.Reporter.Name,
                        Email = dbIssue.Reporter.Email,
                        AvatarUrl = dbIssue.Reporter.AvatarUrl,
                        IsActive = dbIssue.Reporter.IsActive
                    },
                    Assignee = dbIssue.Assignee != null ? new UserDTO
                    {
                        Id = dbIssue.Assignee.Id,
                        Name = dbIssue.Assignee.Name,
                        Email = dbIssue.Assignee.Email,
                        AvatarUrl = dbIssue.Assignee.AvatarUrl,
                        IsActive = dbIssue.Assignee.IsActive
                    } : null,
                    CreatedAt = dbIssue.CreatedAt,
                    UpdatedAt = dbIssue.UpdatedAt
                };

                return CreatedAtAction(nameof(GetIssue), new { issueId = response.Id }, response);
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "An error occurred while creating the issue and generating the sequential key." });
            }
        }

        [HttpPut("api/issues/{issueId}")]
        [ProjectAuthorize] // Any project member can update issues
        public async Task<IActionResult> UpdateIssue(Guid issueId, [FromBody] IssueUpdateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Summary))
            {
                return BadRequest(new { message = "Issue Summary is required." });
            }

            var issue = await _context.Issues.FirstOrDefaultAsync(i => i.Id == issueId);
            if (issue == null)
            {
                return NotFound(new { message = "Issue not found." });
            }

            // Validations
            if (!await _context.IssueTypes.AnyAsync(t => t.Id == request.IssueTypeId))
            {
                return BadRequest(new { message = "Invalid IssueType ID." });
            }

            if (!await _context.Priorities.AnyAsync(p => p.Id == request.PriorityId))
            {
                return BadRequest(new { message = "Invalid Priority ID." });
            }

            if (!await _context.TaskStatuses.AnyAsync(s => s.Id == request.StatusId))
            {
                return BadRequest(new { message = "Invalid Status ID." });
            }

            if (request.AssigneeId.HasValue)
            {
                var isAssigneeParticipant = await _context.ProjectParticipants
                    .AnyAsync(p => p.ProjectId == issue.ProjectId && p.UserId == request.AssigneeId.Value);
                if (!isAssigneeParticipant)
                {
                    return BadRequest(new { message = "The assigned user must be a participant in the project." });
                }
            }

            issue.Summary = request.Summary.Trim();
            issue.Description = request.Description?.Trim();
            issue.IssueTypeId = request.IssueTypeId;
            issue.PriorityId = request.PriorityId;
            issue.StatusId = request.StatusId;
            issue.AssigneeId = request.AssigneeId;
            issue.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Fetch fully populated to return
            var dbIssue = await _context.Issues
                .Include(i => i.IssueType)
                .Include(i => i.Priority)
                .Include(i => i.Status)
                .Include(i => i.Reporter)
                .Include(i => i.Assignee)
                .FirstAsync(i => i.Id == issue.Id);

            var response = new IssueResponse
            {
                Id = dbIssue.Id,
                SequentialKey = dbIssue.SequentialKey,
                Summary = dbIssue.Summary,
                Description = dbIssue.Description,
                ProjectId = dbIssue.ProjectId,
                IssueTypeId = dbIssue.IssueTypeId,
                IssueType = dbIssue.IssueType.Name,
                PriorityId = dbIssue.PriorityId,
                Priority = dbIssue.Priority.Name,
                StatusId = dbIssue.StatusId,
                Status = dbIssue.Status.Name,
                Reporter = new UserDTO
                {
                    Id = dbIssue.Reporter.Id,
                    Name = dbIssue.Reporter.Name,
                    Email = dbIssue.Reporter.Email,
                    AvatarUrl = dbIssue.Reporter.AvatarUrl,
                    IsActive = dbIssue.Reporter.IsActive
                },
                Assignee = dbIssue.Assignee != null ? new UserDTO
                {
                    Id = dbIssue.Assignee.Id,
                    Name = dbIssue.Assignee.Name,
                    Email = dbIssue.Assignee.Email,
                    AvatarUrl = dbIssue.Assignee.AvatarUrl,
                    IsActive = dbIssue.Assignee.IsActive
                } : null,
                CreatedAt = dbIssue.CreatedAt,
                UpdatedAt = dbIssue.UpdatedAt
            };

            return Ok(response);
        }

        [HttpPut("api/issues/{issueId}/status")]
        [ProjectAuthorize] // Any project member can move issues
        public async Task<IActionResult> UpdateIssueStatus(Guid issueId, [FromBody] IssueStatusUpdateRequest request)
        {
            var issue = await _context.Issues.FirstOrDefaultAsync(i => i.Id == issueId);
            if (issue == null)
            {
                return NotFound(new { message = "Issue not found." });
            }

            if (!await _context.TaskStatuses.AnyAsync(s => s.Id == request.StatusId))
            {
                return BadRequest(new { message = "Invalid TaskStatus ID." });
            }

            // Perform status transition (log state changes or validations)
            var oldStatusId = issue.StatusId;
            issue.StatusId = request.StatusId;
            issue.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = "Status updated successfully.",
                issueId = issue.Id,
                oldStatusId = oldStatusId,
                newStatusId = issue.StatusId 
            });
        }

        [HttpDelete("api/issues/{issueId}")]
        [ProjectAuthorize("Administrator", "Manager")] // Only Admins and Managers can delete issues
        public async Task<IActionResult> DeleteIssue(Guid issueId)
        {
            var issue = await _context.Issues.FindAsync(issueId);
            if (issue == null)
            {
                return NotFound(new { message = "Issue not found." });
            }

            _context.Issues.Remove(issue);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Issue deleted successfully." });
        }
    }
}
