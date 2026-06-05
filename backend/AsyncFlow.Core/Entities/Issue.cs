using System;
using System.Collections.Generic;

namespace AsyncFlow.Core.Entities
{
    public class Issue
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string SequentialKey { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string? Description { get; set; }

        public Guid ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public int IssueTypeId { get; set; }
        public IssueType IssueType { get; set; } = null!;

        public int PriorityId { get; set; }
        public Priority Priority { get; set; } = null!;

        public int StatusId { get; set; }
        public TaskStatus Status { get; set; } = null!;

        public Guid ReporterId { get; set; }
        public User Reporter { get; set; } = null!;

        public Guid? AssigneeId { get; set; }
        public User? Assignee { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    }
}
