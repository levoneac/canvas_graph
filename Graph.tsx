"use client"

import { useEffect, useRef, SyntheticEvent } from "react";
import {Grapher, GraphType, OptionalGlobalOptions, OptionalDrawOptions} from "./graph";

export default function Graph({ xy_data, plot_type, global_options, individual_options, className }: { xy_data: Array<Array<[number, number]>>, plot_type: GraphType[], global_options?: OptionalGlobalOptions, individual_options?: OptionalDrawOptions[], className?: string }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (canvas === null) {
            return; //finnes kanskje ikke
        }
        const context = canvas.getContext("2d");
        if (context === null) {
            return; //finnes kanskje ikke
        }
        if (xy_data === undefined) {
            xy_data = []
        }
        if (individual_options === undefined) {
            individual_options = []
        }

        let graph: Grapher = new Grapher(context, true, global_options);


        for (let i = 0; i < xy_data.length; i++) {
            if (individual_options[i] === undefined) {
                individual_options[i] = {};
            }
            if (plot_type[i] === "line") {
                graph.line(xy_data[i], individual_options[i], false);
            }
            if (plot_type[i] === "scatter") {
                graph.scatter(xy_data[i], individual_options[i], false);
            }
            //graph.zoom_intensity = 0.01

        }
    }, [])

    return (
        <canvas ref={ref} className={className} />
    );
}


//let e: Array<[number, number]> = [];
//function f(x: number, z: number) {
//    return Math.sin(x) * Math.tanh(z);
//}
//let u = 0;
//for (let i = -300; i < 300; i++) {
//    for (let j = -2; j < 2; j++) {
//        e[u] = [i / 10, f(i / 10, j / 100)];
//        u++;
//    }
//}
//const data3: Array<[number, number]> = e