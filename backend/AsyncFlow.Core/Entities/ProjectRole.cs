namespace AsyncFlow.Core.Entities
{
    public class ProjectRole
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public const int Administrator = 1;
        public const int Manager = 2;
        public const int Normal = 3;
    }
}
