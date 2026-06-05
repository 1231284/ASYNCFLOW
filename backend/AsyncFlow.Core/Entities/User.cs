using System;
using System.Collections.Generic;

namespace AsyncFlow.Core.Entities
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public bool IsActive { get; set; } = true;

        // Navigation properties
        public ICollection<ProjectParticipant> Participants { get; set; } = new List<ProjectParticipant>();
        public ICollection<Issue> ReportedIssues { get; set; } = new List<Issue>();
        public ICollection<Issue> AssignedIssues { get; set; } = new List<Issue>();
        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    }
}
