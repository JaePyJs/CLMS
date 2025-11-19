declare module 'bcryptjs' {
  interface Bcrypt {
    hash(data: string, saltOrRounds: number | string): Promise<string>;
    compare(data: string, encrypted: string): Promise<boolean>;
    genSalt(rounds?: number): Promise<string>;
  }
  const bcrypt: Bcrypt;
  export default bcrypt;
}