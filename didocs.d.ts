type DidocsOptions = {
    src: string;
    dest: string;
    template: string;
    outputExt: string;
};
export function run(options: DidocsOptions): NodeJS.ReadWriteStream;