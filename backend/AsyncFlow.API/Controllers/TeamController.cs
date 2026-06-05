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
    public class TeamController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TeamController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("{projectId}/participants")]
        [ProjectAuthorize("Administrator", "Manager")] // Managers and Admins can invite
        public async Task<IActionResult> AddParticipant(Guid projectId, [FromBody] AddParticipantRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { message = "User email is required." });
            }

            var emailNormalized = request.Email.Trim().ToLower();
            var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == emailNormalized && u.IsActive);
            if (targetUser == null)
            {
                return NotFound(new { message = $"User with email '{request.Email}' not found." });
            }

            var isAlreadyMember = await _context.ProjectParticipants
                .AnyAsync(p => p.ProjectId == projectId && p.UserId == targetUser.Id);
            if (isAlreadyMember)
            {
                return BadRequest(new { message = "User is already a participant in this project." });
            }

            // Map role name to role ID
            int roleId;
            var requestedRole = request.RoleName.Trim();
            if (requestedRole.Equals("Administrator", StringComparison.OrdinalIgnoreCase))
            {
                roleId = ProjectRole.Administrator;
            }
            else if (requestedRole.Equals("Manager", StringComparison.OrdinalIgnoreCase))
            {
                roleId = ProjectRole.Manager;
            }
            else if (requestedRole.Equals("Normal", StringComparison.OrdinalIgnoreCase))
            {
                roleId = ProjectRole.Normal;
            }
            else
            {
                return BadRequest(new { message = "Invalid role name. Allowed roles are: Administrator, Manager, Normal." });
            }

            // RBAC Hierarchy check:
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(currentUserIdClaim, out Guid currentUserId);
            
            var currentParticipant = await _context.ProjectParticipants
                .Include(p => p.ProjectRole)
                .FirstOrDefaultAsync(p => p.ProjectId == projectId && p.UserId == currentUserId);

            if (currentParticipant == null)
            {
                return Forbid();
            }

            // Managers CANNOT add Administrators
            if (currentParticipant.ProjectRole.Name == "Manager" && roleId == ProjectRole.Administrator)
            {
                return BadRequest(new { message = "Access Forbidden: Managers cannot add members as Administrators." });
            }

            var participant = new ProjectParticipant
            {
                ProjectId = projectId,
                UserId = targetUser.Id,
                ProjectRoleId = roleId,
                JoinedAt = DateTime.UtcNow
            };

            _context.ProjectParticipants.Add(participant);
            await _context.SaveChangesAsync();

            // Return user details
            var dbParticipant = await _context.ProjectParticipants
                .Include(p => p.User)
                .Include(p => p.ProjectRole)
                .FirstAsync(p => p.ProjectId == projectId && p.UserId == targetUser.Id);

            return Ok(new ParticipantDTO
            {
                UserId = dbParticipant.UserId,
                Name = dbParticipant.User.Name,
                Email = dbParticipant.User.Email,
                AvatarUrl = dbParticipant.User.AvatarUrl,
                RoleName = dbParticipant.ProjectRole.Name,
                JoinedAt = dbParticipant.JoinedAt
            });
        }

        [HttpDelete("{projectId}/participants/{userId}")]
        [ProjectAuthorize("Administrator", "Manager")] // Managers and Admins can remove
        public async Task<IActionResult> RemoveParticipant(Guid projectId, Guid userId)
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(currentUserIdClaim, out Guid currentUserId);

            if (currentUserId == userId)
            {
                return BadRequest(new { message = "You cannot remove yourself using this endpoint. Please use the Leave endpoint instead." });
            }

            var targetParticipant = await _context.ProjectParticipants
                .Include(p => p.ProjectRole)
                .FirstOrDefaultAsync(p => p.ProjectId == projectId && p.UserId == userId);

            if (targetParticipant == null)
            {
                return NotFound(new { message = "User is not a participant of this project." });
            }

            var currentParticipant = await _context.ProjectParticipants
                .Include(p => p.ProjectRole)
                .FirstOrDefaultAsync(p => p.ProjectId == projectId && p.UserId == currentUserId);

            if (currentParticipant == null)
            {
                return Forbid();
            }

            // Managers can ONLY remove Normal users (cannot remove Admins or other Managers)
            if (currentParticipant.ProjectRole.Name == "Manager")
            {
                if (targetParticipant.ProjectRole.Name == "Administrator" || targetParticipant.ProjectRole.Name == "Manager")
                {
                    return BadRequest(new { message = "Access Forbidden: Managers can only remove Normal participants." });
                }
            }

            _context.ProjectParticipants.Remove(targetParticipant);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Participant removed successfully." });
        }

        [HttpPut("{projectId}/participants/{userId}/role")]
        [ProjectAuthorize("Administrator")] // Only Administrator can promote/demote (change user roles)
        public async Task<IActionResult> UpdateParticipantRole(Guid projectId, Guid userId, [FromBody] UpdateParticipantRoleRequest request)
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(currentUserIdClaim, out Guid currentUserId);

            var targetParticipant = await _context.ProjectParticipants
                .Include(p => p.ProjectRole)
                .FirstOrDefaultAsync(p => p.ProjectId == projectId && p.UserId == userId);

            if (targetParticipant == null)
            {
                return NotFound(new { message = "User is not a participant of this project." });
            }

            // Map role name to ID
            int roleId;
            var requestedRole = request.RoleName.Trim();
            if (requestedRole.Equals("Administrator", StringComparison.OrdinalIgnoreCase))
            {
                roleId = ProjectRole.Administrator;
            }
            else if (requestedRole.Equals("Manager", StringComparison.OrdinalIgnoreCase))
            {
                roleId = ProjectRole.Manager;
            }
            else if (requestedRole.Equals("Normal", StringComparison.OrdinalIgnoreCase))
            {
                roleId = ProjectRole.Normal;
            }
            else
            {
                return BadRequest(new { message = "Invalid role name. Allowed roles are: Administrator, Manager, Normal." });
            }

            // Safety check: if demoting yourself (the current user), make sure there is at least one other Administrator
            if (currentUserId == userId && roleId != ProjectRole.Administrator)
            {
                var otherAdminsCount = await _context.ProjectParticipants
                    .CountAsync(p => p.ProjectId == projectId && p.ProjectRoleId == ProjectRole.Administrator && p.UserId != userId);

                if (otherAdminsCount == 0)
                {
                    return BadRequest(new { message = "You cannot demote yourself because you are the only Administrator left. Please promote someone else to Administrator first." });
                }
            }

            targetParticipant.ProjectRoleId = roleId;
            await _context.SaveChangesAsync();

            var updatedParticipant = await _context.ProjectParticipants
                .Include(p => p.User)
                .Include(p => p.ProjectRole)
                .FirstAsync(p => p.ProjectId == projectId && p.UserId == userId);

            return Ok(new ParticipantDTO
            {
                UserId = updatedParticipant.UserId,
                Name = updatedParticipant.User.Name,
                Email = updatedParticipant.User.Email,
                AvatarUrl = updatedParticipant.User.AvatarUrl,
                RoleName = updatedParticipant.ProjectRole.Name,
                JoinedAt = updatedParticipant.JoinedAt
            });
        }
    }
}
