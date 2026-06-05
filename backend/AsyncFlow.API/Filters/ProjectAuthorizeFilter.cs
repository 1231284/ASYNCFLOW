using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using AsyncFlow.Infrastructure.Data;
using AsyncFlow.Core.Entities;

namespace AsyncFlow.API.Filters
{
    public class ProjectAuthorizeFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _context;
        private readonly string[] _allowedRoles;

        public ProjectAuthorizeFilter(AppDbContext context, string[] allowedRoles)
        {
            _context = context;
            _allowedRoles = allowedRoles;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // 1. Get current authenticated user ID
            var userIdClaim = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out Guid userId))
            {
                context.Result = new UnauthorizedObjectResult(new { message = "Unauthorized: User ID not found in token." });
                return;
            }

            // 2. Extract Project ID from route parameters, query string, or header
            Guid? projectId = null;

            if (context.RouteData.Values.TryGetValue("projectId", out var routeProjId) && routeProjId != null)
            {
                if (Guid.TryParse(routeProjId.ToString(), out var pId))
                    projectId = pId;
            }
            else if (context.RouteData.Values.TryGetValue("issueId", out var routeIssueId) && routeIssueId != null)
            {
                if (Guid.TryParse(routeIssueId.ToString(), out var issueId))
                {
                    // Look up issue to find project
                    var issue = await _context.Issues.AsNoTracking().FirstOrDefaultAsync(i => i.Id == issueId);
                    if (issue != null)
                        projectId = issue.ProjectId;
                }
            }

            if (projectId == null)
            {
                // Try from query parameters
                if (context.HttpContext.Request.Query.TryGetValue("projectId", out var queryProjId))
                {
                    if (Guid.TryParse(queryProjId.ToString(), out var pId))
                        projectId = pId;
                }
            }

            if (projectId == null)
            {
                context.Result = new BadRequestObjectResult(new { message = "Project ID could not be identified." });
                return;
            }

            // 3. Query the participant and their role in the project
            var participant = await _context.ProjectParticipants
                .AsNoTracking()
                .Include(p => p.ProjectRole)
                .FirstOrDefaultAsync(p => p.ProjectId == projectId && p.UserId == userId);

            if (participant == null)
            {
                context.Result = new ObjectResult(new { message = "Access Forbidden: You are not a member of this project." }) { StatusCode = 403 };
                return;
            }

            var userRole = participant.ProjectRole.Name;

            // 4. Check hierarchical role access:
            // Admin (can do anything)
            // Manager (can do Manager & Normal actions)
            // Normal (can only do Normal actions)
            bool isAuthorized = false;

            if (userRole == "Administrator")
            {
                isAuthorized = true;
            }
            else if (userRole == "Manager")
            {
                // Allowed if looking for Manager, Normal or if allowedRoles is empty
                isAuthorized = _allowedRoles.Length == 0 || 
                               _allowedRoles.Contains("Manager") || 
                               _allowedRoles.Contains("Normal");
            }
            else if (userRole == "Normal")
            {
                // Allowed only if Normal or if allowedRoles is empty
                isAuthorized = _allowedRoles.Length == 0 || 
                               _allowedRoles.Contains("Normal");
            }

            if (!isAuthorized)
            {
                context.Result = new ObjectResult(new { message = $"Access Forbidden: Required role permissions not met. Allowed roles: {string.Join(", ", _allowedRoles)}" }) { StatusCode = 403 };
                return;
            }

            // 5. Store role and projectId in context items for controllers to access directly
            context.HttpContext.Items["ProjectRole"] = userRole;
            context.HttpContext.Items["ProjectId"] = projectId;

            await next();
        }
    }
}
