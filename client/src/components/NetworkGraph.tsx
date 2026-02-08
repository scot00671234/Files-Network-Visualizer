import React, { useRef, useMemo } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';

interface Node {
    id: number;
    name: string;
    type: string;
    // ... other props
}

interface Link {
    source: number | Node;
    target: number | Node;
    relationship_type: string;
}

interface GraphData {
    nodes: Node[];
    links: Link[];
}

interface NetworkGraphProps {
    data: GraphData;
    searchTerm: string;
    onNodeClick?: (node: Node) => void;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, searchTerm, onNodeClick }) => {
    const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

    // Filter nodes/links based on search
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const lowerTerm = searchTerm.toLowerCase();
        const filteredNodes = data.nodes.filter(n => n.name.toLowerCase().includes(lowerTerm));
        const nodeIds = new Set(filteredNodes.map(n => n.id));

        // Include edges where BOTH source and target are in the filtered set
        const filteredLinks = data.links.filter(l => {
            const sourceId = typeof l.source === 'object' ? (l.source as Node).id : l.source;
            const targetId = typeof l.target === 'object' ? (l.target as Node).id : l.target;
            return nodeIds.has(sourceId as number) && nodeIds.has(targetId as number);
        });

        return { nodes: filteredNodes, links: filteredLinks };
    }, [searchTerm, data]);

    return (
        <div style={{ width: '100%', height: '100vh', background: '#050505' }}>
            <ForceGraph2D
                ref={fgRef}
                graphData={filteredData}
                nodeLabel="name"
                nodeColor={(node: any) => node.type === 'person' ? '#4a90e2' : '#ff5252'}
                linkColor={() => 'rgba(255,255,255,0.15)'}
                nodeRelSize={6}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                backgroundColor="#050505"
                onNodeClick={(node) => {
                    fgRef.current?.centerAt(node.x, node.y, 1000);
                    fgRef.current?.zoom(8, 2000);
                    if (onNodeClick) onNodeClick(node as Node);
                }}
            />
        </div>
    );
};

export default NetworkGraph;
export type { GraphData, Node, Link };
