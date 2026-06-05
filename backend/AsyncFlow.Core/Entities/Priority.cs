namespace AsyncFlow.Core.Entities
{
    public class Priority
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public const int Low = 1;
        public const int Medium = 2;
        public const int High = 3;
        public const int Critical = 4;
    }
}
