/** Framework-neutral shape of one site request's decoded query parameters. */
export type SearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

