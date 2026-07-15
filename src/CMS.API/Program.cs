using CMS.API.Data;
using CMS.API.Data.TypeHandlers;
using CMS.API.Repositories;
using CMS.API.Security;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Dapper type handlers for DateOnly / TimeOnly (SqlClient does not map these natively).
SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
SqlMapper.AddTypeHandler(new TimeOnlyTypeHandler());

const string CorsPolicy = "CmsCors";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:4200" };

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Development escape hatch: `Auth:Disabled` drops the global authorize filter so the API serves
// unauthenticated requests. Must stay false/absent outside development, and the Angular client
// needs its own `authDisabled` flag set to match.
var authDisabled = builder.Configuration.GetValue<bool>("Auth:Disabled");

builder.Services.AddControllers(options =>
{
    // Require an authenticated user on every endpoint by default; AuthController opts out
    // with [AllowAnonymous] on its login action.
    if (!authDisabled)
    {
        options.Filters.Add(new AuthorizeFilter());
    }
});

builder.Services.AddSingleton<ISigningKeyProvider, SigningKeyProvider>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

// The signing key is SysConfig['appConfig'].symmetricSecurityKey — the same key AuthController
// uses to issue tokens. Resolved lazily (via ISigningKeyProvider) on first validation so startup
// never blocks on the database.
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<ISigningKeyProvider>((options, signingKeyProvider) =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeyResolver = (_, _, _, _) => new[] { signingKeyProvider.GetSigningKey() },
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "CMS API", Version = "v1" });
});

// Data access
builder.Services.AddSingleton<IDbConnectionFactory, SqlConnectionFactory>();
builder.Services.AddScoped<IAppRoleRepository, AppRoleRepository>();
builder.Services.AddScoped<IAppUserRepository, AppUserRepository>();
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IPublishStatusRepository, PublishStatusRepository>();
builder.Services.AddScoped<IPartnerRepository, PartnerRepository>();
builder.Services.AddScoped<ICourseGroupRepository, CourseGroupRepository>();
builder.Services.AddScoped<ICourseRepository, CourseRepository>();
builder.Services.AddScoped<IFeaturedPromoItemRepository, FeaturedPromoItemRepository>();
builder.Services.AddScoped<ILookupRepository, LookupRepository>();

var app = builder.Build();

if (authDisabled)
{
    app.Logger.LogWarning(
        "Auth:Disabled is set — every endpoint is serving unauthenticated requests. Development only.");
}

// Swagger UI enabled at /swagger for this internal CMS tool.
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "CMS API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors(CorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Exposed so a WebApplicationFactory in the test project can reference the entry point.
public partial class Program { }
