export async function main(event: { message: any; }) {
  return {
    message: `SUCCESS with message ${event.message} 🎉`
  };
}