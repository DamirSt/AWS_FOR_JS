// Filename: authorizer-stack/handler.ts
export async function main(event: any) {
  return {
    message: `SUCCESS with message ${event.message} 🎉`
  };
}