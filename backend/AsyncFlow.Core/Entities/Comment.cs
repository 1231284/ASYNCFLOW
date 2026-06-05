using System;

namespace AsyncFlow.Core.Entities
{
    public class Comment
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid IssueId { get; set; }
        public Issue Issue { get; set; } = null!;

        public Guid AuthorId { get; set; }
        public User Author { get; set; } = null!;

        public string CommentBody { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
