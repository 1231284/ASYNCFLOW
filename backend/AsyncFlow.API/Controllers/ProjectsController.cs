using System;
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
    [Route("api/projects")]
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ProjectsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetProjects()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out Guid userId))
            {
                return Unauthorized();
            }

            var projects = await _context.ProjectParticipants
                .AsNoTracking()
                .Where(p => p.UserId == userId)
                .Include(p => p.Project)
                .Include(p => p.ProjectRole)
                .Select(p => new ProjectResponse
                {
                    Id = p.Project.Id,
                    Name = p.Project.Name,
                    Description = p.Project.Description,
                    Acronym = p.Project.Acronym,
                    CreatedAt = p.Project.CreatedAt,
                    UserRole = p.ProjectRole.Name,
                    MemberCount = _context.ProjectParticipants.Count(x => x.ProjectId == p.ProjectId)
                })
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return Ok(projects);
        }

        [HttpGet("{projectId}")]
        [ProjectAuthorize] // Any participant
        public async Task<IActionResult> GetProject(Guid projectId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out Guid userId))
            {
                return Unauthorized();
            }

            var project = await _context.Projects
                .AsNoTracking()
                .Include(p => p.Participants)
                    .ThenInclude(p => p.User)
                .Include(p => p.Participants)
                    .ThenInclude(p => p.ProjectRole)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
            {
                return NotFound(new { message = "Project not found." });
            }

            var currentParticipant = project.Participants.FirstOrDefault(p => p.UserId == userId);
            if (currentParticipant == null)
            {
                return Forbid();
            }

            var response = new ProjectDetailResponse
            {
                Id = project.Id,
                Name = project.Name,
                Description = project.Description,
                Acronym = project.Acronym,
                CreatedAt = project.CreatedAt,
                CurrentUserRole = currentParticipant.ProjectRole.Name,
                Participants = project.Participants
                    .Where(p => p.User.IsActive)
                    .Select(p => new ParticipantDTO
                    {
                        UserId = p.UserId,
                        Name = p.User.Name,
                        Email = p.User.Email,
                        AvatarUrl = p.User.AvatarUrl,
                        RoleName = p.ProjectRole.Name,
                        JoinedAt = p.JoinedAt
                    })
                    .OrderBy(p => p.Name)
                    .ToList()
            };

            return Ok(response);
        }

        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] ProjectCreateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Acronym))
            {
                return BadRequest(new { message = "Name and Acronym are required." });
            }

            var acronymUpper = request.Acronym.Trim().ToUpper();
            if (acronymUpper.Length > 10)
            {
                return BadRequest(new { message = "Acronym must be 10 characters or less." });
            }

            if (await _context.Projects.AnyAsync(p => p.Acronym.ToUpper() == acronymUpper))
            {
                return BadRequest(new { message = "Acronym is already in use by another project." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out Guid userId))
            {
                return Unauthorized();
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var project = new Project
                {
                    Id = Guid.NewGuid(),
                    Name = request.Name.Trim(),
                    Description = request.Description?.Trim(),
                    Acronym = acronymUpper,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Projects.Add(project);

                // Add creator as Administrator
                var participant = new ProjectParticipant
                {
                    ProjectId = project.Id,
                    UserId = userId,
                    ProjectRoleId = ProjectRole.Administrator,
                    JoinedAt = DateTime.UtcNow
                };

                _context.ProjectParticipants.Add(participant);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return CreatedAtAction(nameof(GetProject), new { projectId = project.Id }, new ProjectResponse
                {
                    Id = project.Id,
                    Name = project.Name,
                    Description = project.Description,
                    Acronym = project.Acronym,
                    CreatedAt = project.CreatedAt,
                    UserRole = "Administrator",
                    MemberCount = 1
                });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "An error occurred while creating the project." });
            }
        }

        [HttpPut("{projectId}")]
        [ProjectAuthorize("Administrator")] // Only Administrator can update project details
        public async Task<IActionResult> UpdateProject(Guid projectId, [FromBody] ProjectUpdateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Acronym))
            {
                return BadRequest(new { message = "Name and Acronym are required." });
            }

            var project = await _context.Projects.FindAsync(projectId);
            if (project == null)
            {
                return NotFound(new { message = "Project not found." });
            }

            var acronymUpper = request.Acronym.Trim().ToUpper();
            if (project.Acronym != acronymUpper)
            {
                if (await _context.Projects.AnyAsync(p => p.Acronym.ToUpper() == acronymUpper && p.Id != projectId))
                {
                    return BadRequest(new { message = "Acronym is already in use by another project." });
                }
            }

            project.Name = request.Name.Trim();
            project.Description = request.Description?.Trim();
            project.Acronym = acronymUpper;

            await _context.SaveChangesAsync();
            return Ok(project);
        }

        [HttpDelete("{projectId}")]
        [ProjectAuthorize("Administrator")] // Only Administrator can delete project
        public async Task<IActionResult> DeleteProject(Guid projectId)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null)
            {
                return NotFound(new { message = "Project not found." });
            }

            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Project deleted successfully." });
        }

        [HttpPost("{projectId}/leave")]
        [ProjectAuthorize] // Any member
        public async Task<IActionResult> LeaveProject(Guid projectId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out Guid userId))
            {
                return Unauthorized();
            }

            var participant = await _context.ProjectParticipants
                .FirstOrDefaultAsync(p => p.ProjectId == projectId && p.UserId == userId);

            if (participant == null)
            {
                return BadRequest(new { message = "You are not a member of this project." });
            }

            // Check if user is the last Administrator
            if (participant.ProjectRoleId == ProjectRole.Administrator)
            {
                var otherAdminsCount = await _context.ProjectParticipants
                    .CountAsync(p => p.ProjectId == projectId && p.ProjectRoleId == ProjectRole.Administrator && p.UserId != userId);

                var totalMembersCount = await _context.ProjectParticipants
                    .CountAsync(p => p.ProjectId == projectId && p.UserId != userId);

                if (otherAdminsCount == 0 && totalMembersCount > 0)
                {
                    return BadRequest(new { message = "You cannot leave the project because you are the only Administrator. Please promote another participant to Administrator first." });
                }

                // If they are the last member, we allow leaving and we can clean up the project
                if (totalMembersCount == 0)
                {
                    var project = await _context.Projects.FindAsync(projectId);
                    if (project != null)
                    {
                        _context.Projects.Remove(project);
                        await _context.SaveChangesAsync();
                        return Ok(new { message = "You left the project, and the project has been deleted since it had no other members." });
                    }
                }
            }

            _context.ProjectParticipants.Remove(participant);
            await _context.SaveChangesAsync();

            return Ok(new { message = "You have left the project successfully." });
        }
    }
}
