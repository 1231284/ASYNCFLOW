namespace AsyncFlow.Core.Entities
{
    public class IssueType
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public const int Task = 1;
        public const int Bug = 2;
        public const int Story = 3;
    }
}
