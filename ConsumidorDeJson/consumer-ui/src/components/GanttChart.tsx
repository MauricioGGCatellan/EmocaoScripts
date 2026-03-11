import { useEffect, useRef } from "react"; 

declare const d3: any; 

type Task = { 
  startDate: Date;
  endDate: Date;
  taskName: string;
  status: string;
};
 
type Props = {
  tasks: Task[];
  taskNames: string[];
  taskStatus: any;
  width?: number;
  height?: number; 
};

export function GanttChart({ tasks, taskNames, taskStatus, width = 800, height = 600 }: Props) {
  const svgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
 
    console.log(tasks);
    console.log(taskNames);
    console.log(taskStatus);
    const start = d3.min(tasks, (d:Task) => d.startDate);
    const end = d3.max(tasks, (d:Task) => d.endDate);

    const svg = d3.select(svgRef.current); 

    // limpa renderizações anteriores
    svg.selectAll("*").remove();
 
    const d3gantt = d3.gantt().taskTypes(taskNames).taskStatus(taskStatus)
      .selector(svgRef.current).timeDomain([start, end]).zoomEnabled(false)
      .timeDomainMode("fixed")

    const svgCall = svg   
      .datum(tasks)
 
    console.log("datum check", d3.select(svgRef.current).datum());
    svgCall.call(d3gantt);

  }, [tasks, width, height, taskNames, taskStatus]);

  return (<div ref={svgRef} />);
}