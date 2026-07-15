using CMS.API.Auditing;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace CMS.API.Tests;

/// <summary>
/// Resolves every injected service from the real Program.cs container. The other integration tests
/// swap the repositories for mocks, so nothing else would notice a repository whose constructor
/// dependencies are not registered — the RowAudit retrofit added one to all seven.
/// Resolving does not open a connection, so no database is required.
/// </summary>
public class ServiceRegistrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ServiceRegistrationTests(WebApplicationFactory<Program> factory) => _factory = factory;

    public static TheoryData<Type> InjectedServices =>
    [
        typeof(IRowAuditWriter),
        typeof(IAppRoleRepository),
        typeof(IAppUserRepository),
        typeof(IAuthRepository),
        typeof(IPublishStatusRepository),
        typeof(IPartnerRepository),
        typeof(ICourseGroupRepository),
        typeof(ICourseRepository),
        typeof(IFeaturedPromoItemRepository),
        typeof(ILookupRepository),
    ];

    [Theory]
    [MemberData(nameof(InjectedServices))]
    public void InjectedService_ResolvesFromTheRealContainer(Type serviceType)
    {
        using var scope = _factory.Services.CreateScope();

        Assert.NotNull(scope.ServiceProvider.GetRequiredService(serviceType));
    }
}
