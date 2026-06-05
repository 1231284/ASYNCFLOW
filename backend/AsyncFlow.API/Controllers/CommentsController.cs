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
    public class CommentsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CommentsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("api/issues/{issueId}/comments")]
        [ProjectAuthorize] // Any participant of the issue's project can view comments
        public async Task<IActionResult> GetIssueComments(Guid issueId)
        {
            var comments = await _context.Comments
                .AsNoTracking()
                .Where(c => c.IssueId == issueId)
                .Include(c => c.Author)
                .OrderBy(c => c.Timestamp) // Chronological order
                .Select(c => new CommentResponse
                {
                    Id = c.Id,
                    IssueId = c.IssueId,
                    CommentBody = c.CommentBody,
                    Timestamp = c.Timestamp,
                    Author = new UserDTO
                    {
                        Id = c.Author.Id,
                        Name = c.Author.Name,
                        Email = c.Author.Email,
                        AvatarUrl = c.Author.AvatarUrl,
                        IsActive = c.Author.IsActive
                    }
                })
                .ToListAsync();

            return Ok(comments);
        }

        [HttpPost("api/issues/{issueId}/comments")]
        [ProjectAuthorize] // Any participant can leave comments
        public async Task<IActionResult> CreateComment(Guid issueId, [FromBody] CommentCreateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CommentBody))
            {
                return BadRequest(new { message = "Comment body cannot be empty." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(userIdClaim, out Guid currentUserId);

            var issueExists = await _context.Issues.AnyAsync(i => i.Id == issueId);
            if (!issueExists)
            {
                return NotFound(new { message = "Issue not found." });
            }

            var comment = new Comment
            {
                Id = Guid.NewGuid(),
                IssueId = issueId,
                AuthorId = currentUserId,
                CommentBody = request.CommentBody.Trim(),
                Timestamp = DateTime.UtcNow
            };

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            // Fetch fully populated
            var dbComment = await _context.Comments
                .Include(c => c.Author)
                .FirstAsync(c => c.Id == comment.Id);

            var response = new CommentResponse
            {
                Id = dbComment.Id,
                IssueId = dbComment.IssueId,
                CommentBody = dbComment.CommentBody,
                Timestamp = dbComment.Timestamp,
                Author = new UserDTO
                {
                    Id = dbComment.Author.Id,
                    Name = dbComment.Author.Name,
                    Email = dbComment.Author.Email,
                    AvatarUrl = dbComment.Author.AvatarUrl,
                    IsActive = dbComment.Author.IsActive
                }
            };

            return Ok(response);
        }
    }
}
