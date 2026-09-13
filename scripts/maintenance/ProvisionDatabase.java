import java.sql.*;
import java.util.Properties;

/** Explicit one-time role provisioning; uses environment secrets, never command-line credentials. */
class ProvisionDatabase {
  static String required(String name) {
    String value=System.getenv(name);
    if(value==null || value.isBlank())throw new IllegalArgumentException("Missing environment variable: "+name);
    return value;
  }
  public static void main(String[] args) throws Exception {
    String role=required("DB_USERNAME");
    if(!role.matches("[a-z][a-z0-9_]{0,62}"))throw new IllegalArgumentException("Use a lowercase SQL identifier for DB_USERNAME");
    String password=required("DB_PASSWORD");
    if(password.length()<24)throw new IllegalArgumentException("Use a random runtime password of at least 24 characters");
    Properties properties=new Properties();properties.setProperty("user",required("MIGRATION_DB_USERNAME"));properties.setProperty("password",required("MIGRATION_DB_PASSWORD"));
    try(Connection connection=DriverManager.getConnection(required("MIGRATION_DB_URL"),properties)) {
      connection.setAutoCommit(false);
      try(PreparedStatement query=connection.prepareStatement("select 1 from pg_roles where rolname=?")) {
        query.setString(1,role);
        if(query.executeQuery().next())throw new IllegalStateException("Role already exists; provision command will not overwrite it");
      }
      try(Statement statement=connection.createStatement()) {
        statement.execute("CREATE ROLE \""+role+"\" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '"+password.replace("'","''")+"'");
      }
      connection.commit();
      System.out.println("Restricted runtime role created. Flyway will grant application privileges.");
    } catch(SQLException e) {
      throw new IllegalStateException("Database provisioning failed (SQLSTATE "+e.getSQLState()+"). Check connectivity and role-creation permission; credentials were not logged.");
    }
  }
}
