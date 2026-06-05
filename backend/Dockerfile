# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY AsyncFlow.sln ./
COPY AsyncFlow.Core/AsyncFlow.Core.csproj AsyncFlow.Core/
COPY AsyncFlow.Infrastructure/AsyncFlow.Infrastructure.csproj AsyncFlow.Infrastructure/
COPY AsyncFlow.API/AsyncFlow.API.csproj AsyncFlow.API/

# Restore dependencies
RUN dotnet restore AsyncFlow.sln

# Copy all source files
COPY . .

# Build and publish AsyncFlow.API in Release configuration
WORKDIR /src/AsyncFlow.API
RUN dotnet publish -c Release -o /app/publish

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Environment variables
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5000

ENTRYPOINT ["dotnet", "AsyncFlow.API.dll"]
