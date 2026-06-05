using Microsoft.EntityFrameworkCore;
using AsyncFlow.Core.Entities;
using AsyncFlow.Core.Helpers;
using System;
using TaskStatus = AsyncFlow.Core.Entities.TaskStatus;

namespace AsyncFlow.Infrastructure.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Project> Projects { get; set; } = null!;
        public DbSet<ProjectRole> ProjectRoles { get; set; } = null!;
        public DbSet<ProjectParticipant> ProjectParticipants { get; set; } = null!;
        public DbSet<TaskStatus> TaskStatuses { get; set; } = null!;
        public DbSet<IssueType> IssueTypes { get; set; } = null!;
        public DbSet<Priority> Priorities { get; set; } = null!;
        public DbSet<Issue> Issues { get; set; } = null!;
        public DbSet<Comment> Comments { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // User configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.Email).IsUnique();
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Email).IsRequired().HasMaxLength(150);
                entity.Property(e => e.PasswordHash).IsRequired();
            });

            // Project configuration
            modelBuilder.Entity<Project>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.Acronym).IsUnique();
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Acronym).IsRequired().HasMaxLength(10);
            });

            // ProjectRole configuration
            modelBuilder.Entity<ProjectRole>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            });

            // ProjectParticipant configuration (Composite key)
            modelBuilder.Entity<ProjectParticipant>(entity =>
            {
                entity.HasKey(e => new { e.ProjectId, e.UserId });

                // Cascading delete: delete participant when project or user is deleted
                entity.HasOne(e => e.Project)
                    .WithMany(p => p.Participants)
                    .HasForeignKey(e => e.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany(u => u.Participants)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.ProjectRole)
                    .WithMany()
                    .HasForeignKey(e => e.ProjectRoleId)
                    .OnDelete(DeleteBehavior.Restrict); // Protect lookup constraints
            });

            // TaskStatus configuration
            modelBuilder.Entity<TaskStatus>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            });

            // IssueType configuration
            modelBuilder.Entity<IssueType>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            });

            // Priority configuration
            modelBuilder.Entity<Priority>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            });

            // Issue configuration
            modelBuilder.Entity<Issue>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.SequentialKey).IsUnique();
                entity.Property(e => e.Summary).IsRequired().HasMaxLength(250);
                entity.Property(e => e.SequentialKey).IsRequired().HasMaxLength(30);

                // Cascade delete issue when project is deleted
                entity.HasOne(e => e.Project)
                    .WithMany(p => p.Issues)
                    .HasForeignKey(e => e.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Protect lookup tables and users
                entity.HasOne(e => e.Status)
                    .WithMany()
                    .HasForeignKey(e => e.StatusId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.IssueType)
                    .WithMany()
                    .HasForeignKey(e => e.IssueTypeId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Priority)
                    .WithMany()
                    .HasForeignKey(e => e.PriorityId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Reporter)
                    .WithMany(u => u.ReportedIssues)
                    .HasForeignKey(e => e.ReporterId)
                    .OnDelete(DeleteBehavior.Restrict); // Reporter deletion restricted

                entity.HasOne(e => e.Assignee)
                    .WithMany(u => u.AssignedIssues)
                    .HasForeignKey(e => e.AssigneeId)
                    .OnDelete(DeleteBehavior.SetNull); // Set assignee to null if user is deleted (standard EF behavior)
            });

            // Comment configuration
            modelBuilder.Entity<Comment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.CommentBody).IsRequired().HasMaxLength(2000);

                // Cascade delete comments when issue is deleted
                entity.HasOne(e => e.Issue)
                    .WithMany(i => i.Comments)
                    .HasForeignKey(e => e.IssueId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Restrict author deletion or cascade? Let's restrict and rely on IsActive soft delete
                entity.HasOne(e => e.Author)
                    .WithMany(u => u.Comments)
                    .HasForeignKey(e => e.AuthorId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // Seeding static data
            modelBuilder.Entity<ProjectRole>().HasData(
                new ProjectRole { Id = ProjectRole.Administrator, Name = "Administrator" },
                new ProjectRole { Id = ProjectRole.Manager, Name = "Manager" },
                new ProjectRole { Id = ProjectRole.Normal, Name = "Normal" }
            );

            modelBuilder.Entity<TaskStatus>().HasData(
                new TaskStatus { Id = TaskStatus.ToDo, Name = "To Do" },
                new TaskStatus { Id = TaskStatus.InProgress, Name = "In Progress" },
                new TaskStatus { Id = TaskStatus.Done, Name = "Done" }
            );

            modelBuilder.Entity<IssueType>().HasData(
                new IssueType { Id = IssueType.Task, Name = "Task" },
                new IssueType { Id = IssueType.Bug, Name = "Bug" },
                new IssueType { Id = IssueType.Story, Name = "Story" }
            );

            modelBuilder.Entity<Priority>().HasData(
                new Priority { Id = Priority.Low, Name = "Low" },
                new Priority { Id = Priority.Medium, Name = "Medium" },
                new Priority { Id = Priority.High, Name = "High" },
                new Priority { Id = Priority.Critical, Name = "Critical" }
            );

            // Seed default users (password: name123, e.g. admin123, manager123, user123)
            var adminId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var managerId = Guid.Parse("22222222-2222-2222-2222-222222222222");
            var userId = Guid.Parse("33333333-3333-3333-3333-333333333333");

            modelBuilder.Entity<User>().HasData(
                new User
                {
                    Id = adminId,
                    Name = "Admin User",
                    Email = "admin@asyncflow.com",
                    PasswordHash = PasswordHasher.HashPassword("admin123"),
                    AvatarUrl = "https://api.dicebear.com/7.x/adventurer/svg?seed=admin",
                    IsActive = true
                },
                new User
                {
                    Id = managerId,
                    Name = "Manager User",
                    Email = "manager@asyncflow.com",
                    PasswordHash = PasswordHasher.HashPassword("manager123"),
                    AvatarUrl = "https://api.dicebear.com/7.x/adventurer/svg?seed=manager",
                    IsActive = true
                },
                new User
                {
                    Id = userId,
                    Name = "Normal User",
                    Email = "user@asyncflow.com",
                    PasswordHash = PasswordHasher.HashPassword("user123"),
                    AvatarUrl = "https://api.dicebear.com/7.x/adventurer/svg?seed=normal",
                    IsActive = true
                }
            );
        }
    }
}
