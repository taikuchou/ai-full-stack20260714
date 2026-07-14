using System.Data;
using Dapper;

namespace CMS.API.Data.TypeHandlers;

/// <summary>Maps SQL Server <c>time</c> columns to/from C# <see cref="TimeOnly"/>.</summary>
public class TimeOnlyTypeHandler : SqlMapper.TypeHandler<TimeOnly>
{
    public override TimeOnly Parse(object value) => TimeOnly.FromTimeSpan((TimeSpan)value);

    public override void SetValue(IDbDataParameter parameter, TimeOnly value)
    {
        parameter.DbType = DbType.Time;
        parameter.Value = value.ToTimeSpan();
    }
}
