const GUEST_KEY = "bineisa-stocks-watchlist-v1";
const validSymbol = (s) =>
  typeof s === "string" && /^[A-Z0-9][A-Z0-9.-]{0,24}\.[A-Z0-9]{1,12}$/.test(s);
export class Watchlists {
  constructor(sb) {
    this.sb = sb;
    this.user = null;
    this.rows = [];
    this.error = null;
    this.version = 0;
  }
  async init() {
    if (this.sb) {
      const { data, error } = await this.sb.auth.getSession();
      if (error) throw error;
      this.user = data.session?.user || null;
    }
    await this.load();
  }
  async load() {
    const version = ++this.version;
    this.rows = [];
    this.error = null;
    if (this.user) {
      const userId = this.user.id;
      const { data, error } = await this.sb
        .from("stock_watchlist")
        .select("symbol,list_kind,note,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (version !== this.version || this.user?.id !== userId) return;
      if (error) {
        this.error = new Error(
          "Your saved lists could not be loaded. Please retry shortly.",
        );
        throw this.error;
      }
      this.rows = data || [];
    } else {
      try {
        const rows = JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");
        this.rows = Array.isArray(rows)
          ? rows
              .filter(
                (x) => validSymbol(x.symbol) && x.list_kind === "watchlist",
              )
              .slice(0, 200)
          : [];
      } catch {
        this.rows = [];
      }
    }
  }
  has(symbol, kind = "watchlist") {
    return this.rows.some((r) => r.symbol === symbol && r.list_kind === kind);
  }
  list(kind) {
    return this.rows.filter((r) => r.list_kind === kind);
  }
  async toggle(symbol, kind = "watchlist") {
    if (!validSymbol(symbol) || !["watchlist", "private"].includes(kind))
      throw new Error("Invalid stock.");
    if (kind === "private" && !this.user)
      throw Object.assign(new Error("Sign in to save private stocks."), {
        code: "AUTH_REQUIRED",
      });
    if (this.error) throw this.error;
    const remove = this.has(symbol, kind);
    if (!remove && this.rows.length >= 200)
      throw new Error(
        "Your lists can hold up to 200 stocks. Remove a stock first.",
      );
    const row = {
      symbol,
      list_kind: kind,
      note: "",
      created_at: new Date().toISOString(),
    };
    if (this.user) {
      const userId = this.user.id;
      const { error } = remove
        ? await this.sb
            .from("stock_watchlist")
            .delete()
            .eq("user_id", userId)
            .eq("symbol", symbol)
            .eq("list_kind", kind)
        : await this.sb
            .from("stock_watchlist")
            .upsert(
              { ...row, user_id: userId },
              {
                onConflict: "user_id,symbol,list_kind",
                ignoreDuplicates: true,
              },
            );
      if (error)
        throw new Error("The stock could not be saved. Please try again.");
      if (this.user?.id !== userId) return;
    }
    const next = remove
      ? this.rows.filter((r) => r.symbol !== symbol || r.list_kind !== kind)
      : [row, ...this.rows];
    if (!this.user) {
      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(next));
      } catch {
        throw new Error(
          "Browser storage is unavailable. Sign in to save your list.",
        );
      }
    }
    this.rows = next;
    return !remove;
  }
  async note(symbol, note) {
    if (!this.user) throw new Error("Sign in to save notes.");
    if (note.length > 2000)
      throw new Error("Notes must be 2,000 characters or fewer.");
    const userId = this.user.id;
    const { error } = await this.sb
      .from("stock_watchlist")
      .update({ note })
      .eq("user_id", userId)
      .eq("symbol", symbol)
      .eq("list_kind", "private");
    if (error)
      throw new Error("Your note could not be saved. Please try again.");
    if (this.user?.id === userId) {
      const row = this.rows.find(
        (r) => r.symbol === symbol && r.list_kind === "private",
      );
      if (row) row.note = note;
    }
  }
}
