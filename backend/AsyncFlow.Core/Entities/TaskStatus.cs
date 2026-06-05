namespace AsyncFlow.Core.Entities
{
    public class TaskStatus
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public const int ToDo = 1;
        public const int InProgress = 2;
        public const int Done = 3;
    }
}
