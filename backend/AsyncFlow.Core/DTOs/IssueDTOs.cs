using System;

namespace AsyncFlow.Core.DTOs
{
    public class IssueCreateRequest
    {
        public string Summary { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Guid ProjectId { get; set; }
        public int IssueTypeId { get; set; }
        public int PriorityId { get; set; }
        public int StatusId { get; set; } = 1; // Default to To Do
        public Guid? AssigneeId { get; set; }
    }

    public class IssueUpdateRequest
    {
        public string Summary { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int IssueTypeId { get; set; }
        public int PriorityId { get; set; }
        public int StatusId { get; set; }
        public Guid? AssigneeId { get; set; }
    }

    public class IssueStatusUpdateRequest
    {
        public int StatusId { get; set; }
    }

    public class IssueResponse
    {
        public Guid Id { get; set; }
        public string SequentialKey { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Guid ProjectId { get; set; }
        
        public int IssueTypeId { get; set; }
        public string IssueType { get; set; } = string.Empty;

        public int PriorityId { get; set; }
        public string Priority { get; set; } = string.Empty;

        public int StatusId { get; set; }
        public string Status { get; set; } = string.Empty;

        public UserDTO Reporter { get; set; } = null!;
        public UserDTO? Assignee { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
