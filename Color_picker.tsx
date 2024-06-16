"use client"
import { Dispatch, SetStateAction, useEffect, useReducer, useState } from "react"

export default function Color_picker({ colors, className }: { colors: string[], className?: string }) {
    if (colors.length === 0) {
        colors[0] = "red";
    }
    const [color, setColor] = useState(colors[0]);
    const [click_counts, setClick_counts] = useState(Array<number>(colors.length).fill(0))
    const [, forceUpdate] = useReducer(x => x + 1, 0)
    function add_click(click_count_arr: number[], click_setter: Dispatch<SetStateAction<number[]>>): void {
        click_count_arr[colors.indexOf(color)] += 1;
        click_setter(click_counts);
        forceUpdate();
    }

    useEffect(() => {

        console.log(click_counts)

    }, [click_counts]);

    return (
        <div className={`bg-gradient-to-r from-${color}-600 to-gray-400 ${className}`}>
            {colors.map((c, index) => {
                return (
                    <button
                        type="button"
                        className={`bg-gradient-to-r from-${c}-600 m-8 border-2 rounded-bl-full rounded-tr-full border-white p-6`}
                        key={c}
                        onClick={() => {
                            add_click(click_counts, setClick_counts);
                            setColor(c);
                        }}>{`${c} with  ${click_counts[index]} clicks`}</button>
                );
            })}
            <p>{click_counts[0]}</p>
            <p>{click_counts[1]}</p>
            <p>{click_counts[2]}</p>
            <p>{click_counts[3]}</p>
        </div>
    );
}