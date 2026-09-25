import ReplayViewer from "@/components/replay-viewer";
export default async function ReplayPage({params}:{params:Promise<{gameId:string}>}){const {gameId}=await params;return <ReplayViewer gameId={gameId}/>;}
