async function main(): Promise<void> {
  console.log("Burger Queen Assistant");
  console.log("Digite /help para ver os comandos.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
