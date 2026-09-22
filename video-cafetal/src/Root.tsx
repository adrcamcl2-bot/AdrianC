import "./index.css";
import { MyComposition } from "./Composition";
import { MiSuenoComposition } from "./MiSueno";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <MiSuenoComposition />
    </>
  );
};
