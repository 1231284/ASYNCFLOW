using System;

namespace AsyncFlow.Core.Entities
{
    public class ProjectParticipant
    {
        public Guid ProjectId { get; set; }
        public Project Project { get; set; } = null!;

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public int ProjectRoleId { get; set; }
        public ProjectRole ProjectRole { get; set; } = null!;

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
