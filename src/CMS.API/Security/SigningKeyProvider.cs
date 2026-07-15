using System.Text;
using CMS.API.Repositories;
using Microsoft.IdentityModel.Tokens;

namespace CMS.API.Security;

/// <summary>
/// Resolves the JWT signing key (SysConfig['appConfig'].symmetricSecurityKey) on first use and
/// caches it for the lifetime of the process. Lazy so app startup never blocks on the database,
/// and a singleton over a scoped repository so it composes with <see cref="IAuthRepository"/> DI
/// substitution in tests.
/// </summary>
public interface ISigningKeyProvider
{
    SecurityKey GetSigningKey();
}

public class SigningKeyProvider : ISigningKeyProvider
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly object _lock = new();
    private SecurityKey? _cached;

    public SigningKeyProvider(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    public SecurityKey GetSigningKey()
    {
        if (_cached is not null) return _cached;

        lock (_lock)
        {
            if (_cached is not null) return _cached;

            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IAuthRepository>();
            var signingKey = repository.GetSigningKeyAsync().GetAwaiter().GetResult();
            _cached = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
            return _cached;
        }
    }
}
