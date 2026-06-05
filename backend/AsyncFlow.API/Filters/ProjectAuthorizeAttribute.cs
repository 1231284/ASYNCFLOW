using System;
using Microsoft.AspNetCore.Mvc;

namespace AsyncFlow.API.Filters
{
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
    public class ProjectAuthorizeAttribute : TypeFilterAttribute
    {
        public ProjectAuthorizeAttribute(params string[] allowedRoles) : base(typeof(ProjectAuthorizeFilter))
        {
            Arguments = new object[] { allowedRoles };
        }
    }
}
