import React, { useEffect, useState, useRef } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';

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

const NetworkGraph: React.FC<{ searchTerm: string }> = ({ searchTerm }) => {
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

    useEffect(() => {
        // Use relative path for production compatibility
        fetch('/api/graph')
            .then(res => res.json())
            .then(data => {
                setGraphData(data);
            })
            .catch(err => console.error("Failed to fetch graph data", err));
    }, []);

    // Filter nodes/links based on search
    const filteredData = React.useMemo(() => {
        if (!searchTerm) return graphData;
        const lowerTerm = searchTerm.toLowerCase();
        const filteredNodes = graphData.nodes.filter(n => n.name.toLowerCase().includes(lowerTerm));
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredLinks = graphData.links.filter(l =>
            nodeIds.has(typeof l.source === 'object' ? (l.source as any).id : l.source) &&
            nodeIds.has(typeof l.target === 'object' ? (l.target as any).id : l.target)
        );
        return { nodes: filteredNodes, links: filteredLinks };
    }, [searchTerm, graphData]);

    return (
        <div style={{ width: '100%', height: '100vh', background: '#000' }}>
            {/* Add a key to force re-render if data changes significantly, or let ForceGraph handle it */}
            <ForceGraph2D
                ref={fgRef}
                graphData={filteredData}
                nodeLabel="name"
                nodeColor={node => node.type === 'person' ? '#4a90e2' : '#ff5252'}
                linkColor={() => 'rgba(255,255,255,0.2)'}
                nodeRelSize={6}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                backgroundColor="#050505"
                onNodeClick={node => {
                    fgRef.current?.centerAt(node.x, node.y, 1000);
                    fgRef.current?.zoom(8, 2000);
                }}
            />
        </div>
    );
};

export default NetworkGraph;
