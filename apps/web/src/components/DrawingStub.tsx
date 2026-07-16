/** Drawing tab placeholder — CAD-4 will project ortho views from B-rep. */
export function DrawingStub({ partName }: { partName: string }) {
  return (
    <div className="drawing-stub">
      <div className="drawing-sheet">
        <div className="drawing-titleblock">
          <strong>{partName}</strong>
          <span>Drawing · stub</span>
          <span>Scale 1:2 · A3</span>
        </div>
        <div className="drawing-views">
          <div className="drawing-view">
            <span>FRONT</span>
            <p>Ortho projection from Part Studio — coming in CAD-4</p>
          </div>
          <div className="drawing-view">
            <span>TOP</span>
            <p>Projected view</p>
          </div>
          <div className="drawing-view">
            <span>RIGHT</span>
            <p>Projected view</p>
          </div>
        </div>
      </div>
    </div>
  );
}
