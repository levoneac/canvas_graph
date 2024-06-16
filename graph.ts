type Point = [number, number];
type AxisLabels = [string, string];
interface PointGraphMethods {
    "line": (xy_data: Array<[number, number]>, draw_customization: OptionalDrawOptions, clear_old: boolean) => void,
    "scatter": (xy_data: Array<[number, number]>, draw_customization: OptionalDrawOptions, clear_old: boolean) => void
}


type ChartArea = [number, number, number, number];

class XY_Extremes {
    xmin: number = Number.MAX_VALUE - 1;
    xmax: number = -Number.MAX_VALUE;

    ymax: number = -Number.MAX_VALUE;
    ymin: number = Number.MAX_VALUE - 1;
};

/**
 * Possible properties you can change before plotting
 */
interface DrawOptions {
    line_width: number;
    elem_color: string | CanvasGradient | CanvasPattern;
    area_color: string | CanvasGradient | CanvasPattern;
    area_transaparency: number;
    fill: boolean;
};
type ChartScaleOptions = 1 | 0.96 | 0.95 | 0.9;
interface GlobalOptions {
    chart_scale: ChartScaleOptions;
    edge_padding: number;
    bg_axis_area: string | CanvasGradient | CanvasPattern;
    bg_color: string | CanvasGradient | CanvasPattern;
    draw_grid: boolean;
    axis_titles: AxisLabels;
    n_decimals: number;
    n_gridlines: number;
    chart_border_width: number;
    chart_border_color: string | CanvasGradient | CanvasPattern;
}

export type GraphType = "scatter" | "line";

/**
 * Info about already plotted data
 */
interface OnCanvas {
    [n: PropertyKey]: {
        data: Array<[number, number]>
        options: DrawOptions
        type: GraphType
    }
}


/**
 * Makes all the properties of a type optional
*/
type MakeOptional<T> = {
    [P in keyof T]+?: T[P];
}

/**
 * learning helper to see the internals of a type
*/
type Expose<T> = {
    [P in keyof T]: T[P];
} & {};

let HELP: Expose<CanvasRenderingContext2D>;

/**
 * Type used to take optional customization of the chart
 */
export type OptionalDrawOptions = MakeOptional<DrawOptions>
export type OptionalGlobalOptions = MakeOptional<GlobalOptions>;

function interpol(min: number, max: number, scale: number) {
    return (min + (max - (min)) * scale)
}

function nDecimals(str: string, n_decimals: number): string {
    if (n_decimals <= 0) {
        n_decimals = -1;
    }

    //we dont need that precision :)
    str = str.indexOf("e-") !== -1 ? "0" : str;

    let comma: number = str.indexOf(".");
    if (comma !== -1) {
        let modiefied_str: string = str.slice(0, comma + n_decimals + 1);

        //add back the scientific noatation if it exists
        modiefied_str = str.indexOf("e+") === -1 ? modiefied_str : modiefied_str += str.slice(str.indexOf("e+"));

        return modiefied_str;
    } else {
        return str;
    }

}

abstract class GraphSetup {
    protected context: CanvasRenderingContext2D;

    /**object containing all the currently drawn graphs */
    protected graphs_on_chart: OnCanvas = {};

    /**set after drawing chart */
    protected graph_extists: boolean = false;

    /**the x,y,w,h of the charting area */
    public chart_area!: ChartArea;

    /**the left edge of x */
    public x!: number;

    /**the top edge of y */
    public y!: number;

    /**thie right edge of x */
    public w!: number;

    /**this bottom edge of y */
    public h!: number;

    /**the right edge of the chart after padding */
    protected y_chart_dimension_max!: number;
    /**the left edge of the chart after padding */
    protected y_chart_dimension_min!: number;
    /**the bottom edge of the chart after padding */
    protected x_chart_dimension_max!: number;
    /**the right top of the chart after padding */
    protected x_chart_dimension_min!: number;

    /**the updated bounds of the values on the chart after scroll or drag */
    public newbounds!: XY_Extremes;

    protected label_spacing!: number;

    /**ensures that the axis labeling exists */
    protected axis_numeration_exists: boolean = false;

    protected extremes!: XY_Extremes;
    protected extremes_initializaed: boolean = false;
    public zoom_intensity = 0.15;


    /**options that are shared between all the plots on the same graph */
    protected global_options: GlobalOptions = {
        chart_scale: 0.95,
        edge_padding: 50,
        bg_axis_area: "#eeeeee",
        bg_color: "white",
        draw_grid: true,
        axis_titles: ["X", "Y"],
        n_decimals: 2,
        n_gridlines: 10,
        chart_border_width: 1.4,
        chart_border_color: "black"
    }


    /**options that are specific to one plot */
    protected draw_options: DrawOptions = {
        line_width: 1.4,
        elem_color: "blue",
        area_color: "gray",
        area_transaparency: 1,
        fill: false,
    };

    /**field for temporarily storing backup of the cusomization for restoring */
    protected backup_customization: DrawOptions = this.draw_options;

    protected redraw_event: boolean = false;

    constructor(context: CanvasRenderingContext2D, options?: OptionalGlobalOptions) {
        this.context = context;

        this.context.canvas.style.width = "100%";
        this.context.canvas.style.height = "100%";
        this.context.canvas.width = this.context.canvas.offsetWidth;
        this.context.canvas.height = this.context.canvas.offsetHeight;

        this.initExtremes();
        if (options !== undefined) {
            this.updateGlobalCustomization(options);
        }
        this.chartArea();
        this.applyPaddingToChartDimensionBounds(this.context.canvas.width, this.x, this.h, this.y);
    }

    protected initExtremes() {
        this.extremes = {
            xmax: 0,
            xmin: 0,
            ymax: 0,
            ymin: 0
        };
        this.newbounds = { ...this.extremes }
    }
    /**
     * Get the dimensions of a charting area on x% of the canvas
     * @updates [this.x, this.y, this.w, this.h] ~ Which you can use to draw a rectangle for the chart
     */
    protected chartArea(): void {
        this.label_spacing = (this.context.measureText("").fontBoundingBoxAscent - this.context.measureText("").fontBoundingBoxDescent) * 6;
        this.w = this.global_options.chart_scale !== 1 ? this.context.canvas.width - this.label_spacing * 2 : this.context.canvas.width;;
        this.x = this.context.canvas.width - this.w;
        this.h = this.global_options.chart_scale !== 1 ? this.context.canvas.height - this.label_spacing : this.context.canvas.height;
        this.y = 0;
        this.chart_area = [this.x, this.y, this.w, this.h]
    }

    protected applyPaddingToChartDimensionBounds(x_chart_dimension_max: number, x_chart_dimension_min: number, y_chart_dimension_max: number, y_chart_dimension_min: number) {
        if (this.global_options.edge_padding > this.w / 2) {
            this.x_chart_dimension_max = this.w / 2;
            this.x_chart_dimension_min = this.w / 2;
        } else {
            this.x_chart_dimension_max = this.context.canvas.width - this.global_options.edge_padding;
            this.x_chart_dimension_min = this.x + this.global_options.edge_padding;
        }
        if (this.global_options.edge_padding > this.h / 2) {
            this.y_chart_dimension_max = this.h / 2;
            this.y_chart_dimension_min = this.h / 2;
        } else {
            this.y_chart_dimension_max = this.h - this.global_options.edge_padding;
            this.y_chart_dimension_min = this.y + this.global_options.edge_padding;
        }
    }



    protected drawChartingArea(): void {
        this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
        this.drawAxisArea();
        this.context.fillStyle = this.global_options.bg_color;



        this.context.fillRect(this.x, this.y, this.w, this.h);

        //draw edges of chart
        this.context.strokeStyle = this.global_options.chart_border_color;
        this.context.lineWidth = this.global_options.chart_border_width;
        this.context.beginPath();
        this.context.moveTo(this.x, 0); //start top left
        this.context.lineTo(this.x, this.h); //draw line to bottom left
        this.context.lineTo(this.context.canvas.width, this.h); //bottom left to bottom right
        this.context.stroke();

        this.graph_extists = true;
    }

    protected drawAxisArea(): void {
        this.context.beginPath();
        this.context.fillStyle = this.global_options.bg_axis_area;
        this.context.fillRect(0, 0, this.x - this.global_options.chart_border_width / 2, this.context.canvas.height);
        this.context.fillRect(0, this.h + this.global_options.chart_border_width / 2, this.context.canvas.width, this.context.canvas.height);
    }


    protected drawMissingDataMessage(msg?: string) {
        if (msg === undefined) {
            msg = "No data";
        }
        let chart_width: number = this.context.canvas.width - this.x;
        let chart_middle: number = chart_width - (chart_width / 2);
        let offset_middle: number = this.x + chart_middle - (msg.length * 2);
        this.context.fillText(msg, (offset_middle), (this.h / 2));
    }

    protected saveCustomization() {
        this.backup_customization = { ...this.draw_options };
    }

    protected restoreCustomization() {
        this.draw_options = this.backup_customization;
    }

    protected updateCustomization(opts: OptionalDrawOptions) {
        let keys: string[] = Object.keys(opts);
        for (let i = 0; i < keys.length; i++) {
            let key: keyof DrawOptions = keys[i] as keyof DrawOptions;
            if (this.draw_options.hasOwnProperty(key)) {
                if ((typeof opts[key] === typeof this.draw_options[key]) && (opts[key] !== undefined)) {
                    (this.draw_options[key] as any) = opts[key] //idk what more i can do
                }
            }
        }
    }

    protected updateDefaultCustomization(opts: OptionalDrawOptions) {
        this.updateCustomization(opts);
    }

    protected updateGlobalCustomization(opts: OptionalGlobalOptions) {
        let keys: string[] = Object.keys(opts);
        for (let i = 0; i < keys.length; i++) {
            let key: keyof GlobalOptions = keys[i] as keyof GlobalOptions;
            if (this.global_options.hasOwnProperty(key)) {
                if ((typeof opts[key] === typeof this.global_options[key]) && (opts[key] !== undefined)) {
                    (this.global_options[key] as any) = opts[key]
                }
            }
        }
    }

    protected drawAxisTitles(current_extremes: XY_Extremes): void {
        this.context.save();
        this.drawAxisArea();
        this.context.strokeStyle = "black";
        let splits: number = this.global_options.n_gridlines;
        let [xmax, xmin, ymax, ymin] = this.getAxisBoundsFromXY(current_extremes);
        for (let i = 0; i < splits; i++) {
            this.context.beginPath();
            let [x, y] = [interpol(xmin, xmax, i / splits), interpol(ymax, ymin, i / splits)];
            let scaled_xy = this.pointsToCanvasCoordinate([[x, y]], false, current_extremes);

            if (this.global_options.chart_scale !== 1) {

                //TEXT
                this.context.lineWidth = 0.7;
                let toprint: string;
                let size: number;

                //Y-axis
                this.context.textAlign = "right"
                this.context.textBaseline = "middle"
                toprint = nDecimals(y.toString(10), this.global_options.n_decimals);
                size = this.x - this.context.measureText(toprint).width - 15;
                this.context.strokeText(toprint, this.x - 5, scaled_xy[0][1], this.label_spacing); // this.context.canvas.width - this.w - size

                //X-axis
                this.context.textAlign = "center"
                this.context.textBaseline = "bottom"
                toprint = nDecimals(x.toString(10), this.global_options.n_decimals);
                size = this.x - this.context.measureText(toprint).width - 15;
                this.context.strokeText(toprint, scaled_xy[0][0], this.h + 15, this.label_spacing * (this.w / 500));
            }

            if (this.global_options.draw_grid === true) {
                //LINES
                this.context.lineWidth = 0.5;

                //horizontal
                this.context.moveTo(this.x, scaled_xy[0][1]);
                this.context.lineTo(this.context.canvas.width, scaled_xy[0][1])

                //vertical
                this.context.moveTo(scaled_xy[0][0], this.h);
                this.context.lineTo(scaled_xy[0][0], this.y);
                this.context.stroke()
            }


        }
        //LABELS
        if (this.global_options.chart_scale !== 1) {
            this.context.textBaseline = "alphabetic"
            this.context.textAlign = "left"
            this.context.lineWidth = 1;
            this.context.font = "18px serif"
            this.context.strokeText(this.global_options.axis_titles[0], this.context.canvas.width / 2, this.context.canvas.height - 5)
            this.context.translate(15, this.context.canvas.height / 2) //sets new (0,0) on the canvas
            this.context.rotate(-90 * Math.PI / 180);
            this.context.strokeText(this.global_options.axis_titles[1], -this.x / 4, 0)
            this.axis_numeration_exists = true;
        }
        this.context.restore();
    }

    /**
     * A map callback function to find minimum and maximum value of x and y.
     * @param this An instance of Extremes to update the min and max value of
     * @param xy the array of size 2 with x and y value
     */
    protected find2DMinAndMax(this: XY_Extremes, xy: [number, number]): void {
        let [x, y] = xy;
        if (typeof (x) === "number") {
            if (x > this.xmax) { this.xmax = x }
            if (x < this.xmin) { this.xmin = x }
        }

        if (typeof (y) === "number") {
            if (y > this.ymax) { this.ymax = y }
            if (y < this.ymin) { this.ymin = y }
        }
    }


    /**
     * Scales an array of (x,y) points to fit in a specified area
     */
    protected pointsToCanvasCoordinate(arr: Array<[number, number]>, clear_old: boolean, min_and_max_values?: XY_Extremes): Array<[number, number]> {
        /*determine the min and max of x and y */
        //refactor pls
        if (clear_old === true || this.extremes_initializaed === false || this.redraw_event) {
            if (min_and_max_values === undefined) {
                this.initExtremes();
                arr.map(this.find2DMinAndMax, this.extremes);
                var { xmin, xmax, ymin, ymax } = this.extremes;
                this.newbounds = { ...this.extremes }
                this.extremes_initializaed = true;
            } else {
                var { xmin, xmax, ymin, ymax } = min_and_max_values;
                this.extremes_initializaed = true;
            }
        } else {
            var { xmin, xmax, ymin, ymax } = this.extremes;
        }


        /*Scale every point */
        let scaled_xy: Array<[number, number]> = [];
        let y_boundary: number = this.y_chart_dimension_max - this.global_options.edge_padding;
        if (y_boundary < 0) {
            y_boundary = 0;
        }

        arr.map((xy, i) => {
            let [x, y] = xy

            let x_minmax: number = (x - xmin) / (xmax - xmin);
            x = (this.x_chart_dimension_max - this.x_chart_dimension_min) * x_minmax + this.x_chart_dimension_min;

            let y_minmax: number = (y - ymin) / (ymax - ymin);

            y = y_boundary - (this.y_chart_dimension_max - this.y_chart_dimension_min) * y_minmax + this.y_chart_dimension_min;

            scaled_xy[i] = [x, y];
        });
        return scaled_xy;
    }

    /**Returns what x need to be to return a coordinate at the extremes of the chart */
    protected getAxisBoundsFromXY(current_extremes: XY_Extremes) {
        let xmax = ((this.context.canvas.width - this.x_chart_dimension_min) / (this.x_chart_dimension_max - this.x_chart_dimension_min)) * (current_extremes.xmax - current_extremes.xmin) + current_extremes.xmin;
        let xmin = ((this.x - this.x_chart_dimension_min) / (this.x_chart_dimension_max - this.x_chart_dimension_min)) * (current_extremes.xmax - current_extremes.xmin) + current_extremes.xmin;
        let ymax = ((-this.y_chart_dimension_min) / (this.y_chart_dimension_max - this.y_chart_dimension_min)) * (current_extremes.ymax - current_extremes.ymin) + current_extremes.ymin
        let ymin = ((this.h - this.y_chart_dimension_min) / (this.y_chart_dimension_max - this.y_chart_dimension_min)) * (current_extremes.ymax - current_extremes.ymin) + current_extremes.ymin;
        return [xmax, xmin, ymax, ymin];
    }
    /** Converts a canvas coordinate to the real graph coordinate*/
    protected getPointFromCanvasCoordinate(x: number, y: number, current_extremes: XY_Extremes): [number, number] {
        let converted_x = ((x - this.x_chart_dimension_min) / (this.x_chart_dimension_max - this.x_chart_dimension_min)) * (current_extremes.xmax - current_extremes.xmin) + current_extremes.xmin;
        let converted_y = (((this.h - y) - this.y_chart_dimension_min) / (this.y_chart_dimension_max - this.y_chart_dimension_min)) * (current_extremes.ymax - current_extremes.ymin) + current_extremes.ymin;
        return [converted_x, converted_y];
    }


}


export class Grapher extends GraphSetup {
    protected graph_methods: PointGraphMethods = {
        "line": this.line,
        "scatter": this.scatter
    };
    protected drag_active: boolean = false;
    protected current_drag_movement: Point = [0, 0];
    constructor(context: CanvasRenderingContext2D, interactive?: boolean, options?: OptionalGlobalOptions) {
        super(context, options);

        if (interactive === true) {
            this.context.canvas.addEventListener("wheel", this.handleMouseScroll.bind(this), { passive: false }); //if interactive
            this.context.canvas.addEventListener("mousemove", this.handleMouseDrag.bind(this), { passive: false });
            this.context.canvas.addEventListener("mousedown", this.handleMouseDrag.bind(this), { passive: false });
            this.context.canvas.addEventListener("mouseup", this.handleMouseDrag.bind(this), { passive: false });
            this.context.canvas.addEventListener("mouseleave", this.handleMouseDrag.bind(this), { passive: false });
        }

    }
    /**Line plot */
    public line(xy_data: Array<[number, number]>, draw_customization: OptionalDrawOptions, clear_old: boolean, chart_ref?: keyof OnCanvas): void {
        this.context.save();
        this.saveCustomization();
        this.updateCustomization(draw_customization);


        if (clear_old === true || this.graph_extists === false) {
            this.drawChartingArea();
            this.axis_numeration_exists = false;
            this.graphs_on_chart = {};
        }
        this.context.lineWidth = this.draw_options.line_width;
        this.context.strokeStyle = this.draw_options.elem_color;
        this.context.fillStyle = this.draw_options.area_color;
        if (xy_data.length > 0) {
            let scaled_xy_data: Array<[number, number]>;
            if (this.redraw_event === true && chart_ref !== undefined) {
                scaled_xy_data = this.pointsToCanvasCoordinate(xy_data, false, this.newbounds);
            } else {
                xy_data.sort((a: [number, number], b: [number, number]) => { return a[0] - b[0] }) // gjør dette samtidig som du finner min og max for å spare tid
                scaled_xy_data = this.pointsToCanvasCoordinate(xy_data, clear_old);
                this.graphs_on_chart[Object.keys(this.graphs_on_chart).length] = {
                    data: xy_data,
                    options: { ...this.draw_options },
                    type: "line"
                }
            }

            scaled_xy_data.map((xy, i) => {
                let [x_val, y_val] = xy;

                if (i === 0) {
                    this.context.beginPath();
                    if (this.draw_options.fill === true) {
                        if (x_val < this.x) {
                            this.context.moveTo(x_val, y_val)
                        } else {
                            this.context.moveTo(x_val, this.h - 1);
                        }
                    } else {
                        this.context.moveTo(x_val, y_val);
                    }
                }
                this.context.lineTo(x_val, y_val)
            })

            if (this.draw_options.fill === true) {
                this.context.lineTo(scaled_xy_data[scaled_xy_data.length - 1][0], this.h - 1);
                this.context.stroke(); //dont include the bottom line
                this.context.lineTo(scaled_xy_data[0][0], this.h - 1);
                this.context.globalAlpha = this.draw_options.area_transaparency;
                this.context.fill()
                this.context.globalAlpha = 1;
            } else {
                this.context.stroke();
            }

        } else {
            this.drawMissingDataMessage();
        }
        if (this.redraw_event === false && this.axis_numeration_exists === false) { //else done in the redraw
            this.drawAxisTitles(this.extremes);
        }

        this.context.restore();
        this.restoreCustomization();
    }

    /**Scatter plot */
    public scatter(xy_data: Array<[number, number]>, draw_customization: OptionalDrawOptions, clear_old: boolean, chart_ref?: keyof OnCanvas): void {
        this.context.save();
        this.saveCustomization();
        this.updateCustomization(draw_customization);

        if (clear_old === true || this.graph_extists === false) {
            this.drawChartingArea();
            this.graphs_on_chart = {};
        }
        if (xy_data !== undefined) {
            let scaled_xy_data: Array<[number, number]>;
            if (this.redraw_event === true && chart_ref !== undefined) {
                scaled_xy_data = this.pointsToCanvasCoordinate(xy_data, false, this.newbounds);
            } else {
                scaled_xy_data = this.pointsToCanvasCoordinate(xy_data, clear_old);
                this.graphs_on_chart[Object.keys(this.graphs_on_chart).length] = {
                    data: xy_data,
                    options: { ...this.draw_options },
                    type: "scatter"
                }
            }

            scaled_xy_data.map((xy) => {
                let [x_val, y_val] = xy;
                this.context.beginPath();
                this.context.arc(x_val, y_val, 3, 0, Math.PI * 2, false);
                this.context.fillStyle = this.draw_options.area_color
                this.context.strokeStyle = this.draw_options.elem_color
                if (!(x_val < this.x)) {
                    if (this.draw_options.fill === true) {
                        this.context.fill();
                        this.context.stroke();
                    } else {
                        this.context.stroke();
                    }
                }
            })
        } else {
            this.drawMissingDataMessage(); //potential bug with the line under
        }
        if (this.redraw_event === false && this.axis_numeration_exists === false) { //else done in the redraw
            this.drawAxisTitles(this.extremes);
        }

        this.context.restore();
        this.restoreCustomization();
    }
    /**
     * Redraws the existing graphs
     * @param change the change of the extremes
     */
    protected redrawExisting() {
        this.drawChartingArea();
        let graphs_on_chart: OnCanvas = this.graphs_on_chart

        this.redraw_event = true;

        let graph_keys: string[] = Object.keys(graphs_on_chart);
        for (let i = 0; i < graph_keys.length; i++) {
            let key: keyof OnCanvas = graph_keys[i] as keyof OnCanvas;
            let method: keyof PointGraphMethods = graphs_on_chart[key].type;

            if (method === "line") {
                this.line(graphs_on_chart[key].data, graphs_on_chart[key].options, false, key);
            }

            if (method === "scatter") {
                this.scatter(graphs_on_chart[key].data, graphs_on_chart[key].options, false, key);
            }
        }

        this.drawAxisTitles(this.newbounds)

        this.redraw_event = false;
    }


    protected handleMouseScroll(this: Grapher, event: WheelEvent) {
        let x: number = event.offsetX;
        let y: number = event.offsetY;
        //console.log(x, event.pageX, event.deltaX, event.clientX, event.offsetX, event.screenX)

        //convert the canvas coordinate to the real coordinate
        let [c_x, c_y] = this.getPointFromCanvasCoordinate(x, y, this.newbounds);

        if ((x - this.x > 0) && (y - this.h < 0) && (event.deltaY !== 0)) { //inside the chart
            event.preventDefault();

            let sign: number = 0;
            if (event.deltaY > 0) {
                sign = 1
            } else if (event.deltaY < 0) {
                sign = -1
            }
            let scale: number = 1 + (sign * this.zoom_intensity);


            this.newbounds = {
                xmax: interpol(c_x, this.newbounds.xmax, scale),
                xmin: interpol(c_x, this.newbounds.xmin, scale),
                ymax: interpol(c_y, this.newbounds.ymax, scale),
                ymin: interpol(c_y, this.newbounds.ymin, scale),
            }
            this.redrawExisting();
        } else {

        }
    }

    protected handleMouseDrag(this: Grapher, event: MouseEvent) {
        if ((event.button === 0 && event.buttons === 0 && event.type === "mouseup" && this.drag_active === true) || event.type === "mouseleave") { //release
            this.drag_active = false;
        }
        
        let element: HTMLCanvasElement = event.target as HTMLCanvasElement;
        let offset_left: number = element.offsetLeft;
        let offset_top: number = element.offsetTop;

        let x: number = event.clientX - offset_left;
        let y: number = event.clientY - offset_top;

        if (event.button === 0 && event.buttons === 1 && event.type === "mousedown" && this.drag_active === false) { //press down


            this.drag_active = true;
            this.current_drag_movement = [x, y];
        }
        if (this.drag_active === true) {
            if ((x - this.x > 0) && (y - this.h < 0)) {
                //cant optimize this as you need the current newbounds to do the calculation
                let [original_x, original_y] = this.getPointFromCanvasCoordinate(this.current_drag_movement[0], this.current_drag_movement[1], this.newbounds);
                let [new_x, new_y] = this.getPointFromCanvasCoordinate(x, y, this.newbounds);
                let x_diff: number = -(original_x - new_x);
                let y_diff: number = -(original_y - new_y);

                this.newbounds = {
                    xmax: this.newbounds.xmax - x_diff,
                    xmin: this.newbounds.xmin - x_diff,
                    ymax: this.newbounds.ymax - y_diff,
                    ymin: this.newbounds.ymin - y_diff,
                }

                this.current_drag_movement = [x, y];
                this.redrawExisting();
            }
        }

    }
}
