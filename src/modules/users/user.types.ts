export type User = {
  /** UUID estável no banco */
  id: string;
  /** Login normalizado (ex.: `ana`) — único */
  loginName: string;
  name: string;
  createdAt: string;
};
