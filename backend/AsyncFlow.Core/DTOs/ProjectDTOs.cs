using System;
using System.Collections.Generic;

namespace AsyncFlow.Core.DTOs
{
    public class ProjectCreateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Acronym { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class ProjectUpdateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Acronym { get; set; } = string.Empty;
    }

    public class ProjectResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Acronym { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int MemberCount { get; set; }
        public string UserRole { get; set; } = string.Empty; // User's role in this project
    }

    public class ProjectDetailResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Acronym { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string CurrentUserRole { get; set; } = string.Empty;
        public List<ParticipantDTO> Participants { get; set; } = new List<ParticipantDTO>();
    }

    public class ParticipantDTO
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string RoleName { get; set; } = string.Empty;
        public DateTime JoinedAt { get; set; }
    }

    public class AddParticipantRequest
    {
        public string Email { get; set; } = string.Empty;
        public string RoleName { get; set; } = "Normal";
    }

    public class UpdateParticipantRoleRequest
    {
        public string RoleName { get; set; } = string.Empty;
    }
}
