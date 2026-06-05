using System;

namespace AsyncFlow.Core.DTOs
{
    public class CommentCreateRequest
    {
        public string CommentBody { get; set; } = string.Empty;
    }

    public class CommentResponse
    {
        public Guid Id { get; set; }
        public Guid IssueId { get; set; }
        public UserDTO Author { get; set; } = null!;
        public string CommentBody { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }
}
