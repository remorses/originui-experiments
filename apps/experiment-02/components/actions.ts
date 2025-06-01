"use server"


export async function generateMessage({}) {
  console.log(`generation`)
  await sleep(1000)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
