using System;
using System.Collections.Generic;

namespace AsyncFlow.Core.Entities
{
    public class Project
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Acronym { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<ProjectParticipant> Participants { get; set; } = new List<ProjectParticipant>();
        public ICollection<Issue> Issues { get; set; } = new List<Issue>();
    }
}
