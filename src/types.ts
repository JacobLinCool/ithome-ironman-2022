export interface Article {
    type: string;
    series: string;
    title: string;
    link: string;
    author: string;
    date: number[];
    view: number;
    team?: string | null;
}
