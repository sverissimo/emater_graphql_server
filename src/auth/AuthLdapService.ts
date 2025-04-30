import { Client, SearchOptions } from "ldapts";

export class AuthLdapService {
  private static createClient() {
    return new Client({
      url: process.env.LDAP_SERVER!,
      // optional: timeout, connectTimeout, tlsOptions, strictDN, etc.
    });
  }

  public static async authenticate(
    matricula_usuario: string,
    password: string
  ): Promise<boolean> {
    const client = this.createClient();

    try {
      await client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_PASSWORD!);

      const searchDN = process.env.LDAP_BASE!;
      const opts: SearchOptions = {
        scope: "sub",
        filter: `(cn=${matricula_usuario})`,
        attributes: ["dn"],
      };
      const { searchEntries } = await client.search(searchDN, opts);

      if (searchEntries.length === 0) {
        throw new Error("Usuário não encontrado");
      }

      // pick the first entry's DN
      const userDn = (searchEntries[0] as any).dn as string;

      // 3) attempt to bind as the user
      try {
        await client.bind(userDn, password);
        return true;
      } catch {
        throw new Error("Usuário ou senha inválidos.");
      }
    } finally {
      // always unbind to close the connection
      await client.unbind().catch((err) => {
        console.error("Error unbinding LDAP client:", err);
      });
    }
  }
}
