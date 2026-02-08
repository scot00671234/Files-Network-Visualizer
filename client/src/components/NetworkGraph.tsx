import React, { useEffect, useState, useRef } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';

interface Node {
    id: number;
    name: string;
    type: string;
    // ... other props
}

interface Link {
    source: number;
    target: number;
    relationship_type: string;
}

interface GraphData {
    nodes: Node[];
    links: Link[];
}

const NetworkGraph: React.FC = () => {
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const fgRef = useRef<ForceGraphMethods>();

    useEffect(() => {
        // Fetch graph data from backend
        fetch('http://localhost:3000/api/graph')
            .then(res => res.json())
            .then(data => {
                setGraphData(data);
            })
            .catch(err => console.error("Failed to fetch graph data", err));
    }, []);

    return (
        <div style={{ width: '100%', height: '100vh' }}>
            <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeLabel="name"
                nodeColor={node => node.type === 'person' ? '#4a90e2' : '#e24a4a'}
                linkColor={() => '#999'}
                nodeRelSize={6}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                onNodeClick={node => {
                    // Center view on node
                    fgRef.current?.centerAt(node.x, node.y, 1000);
                    fgRef.current?.zoom(8, 2000);
                }}
            />
        </div>
    );
};

export default NetworkGraph;
