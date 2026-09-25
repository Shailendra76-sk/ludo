import OnlineGame from "@/components/online-game";

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <OnlineGame gameId={gameId} />;
}
