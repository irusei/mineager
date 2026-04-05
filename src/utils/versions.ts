export function sortVersions(versions: string[]) {
    // given a string[] full of versions like "1.7, 1.21, 1.21.22, 1.24-pre4" sort them all accordingly
    return versions.sort((a, b) => {
        const splitA = a.split(".");
        const splitB = b.split(".");

        // new mojang versioning fix
        const yearA = parseInt(splitA[0]);
        const yearB = parseInt(splitB[0]);

        if (yearA > yearB)
            return 1;
        if (yearA < yearB)
            return -1;

        const verA = parseInt(splitA[1]);
        const verB = parseInt(splitB[1]);

        const min = Math.min(splitA.length, splitB.length)
        const max = Math.max(splitA.length, splitB.length)

        // 1.xx vs 1.yy
        if (verA > verB)
            return 1;
        if (verA < verB)
            return -1;

        if (min === 2) {
            // this should have -pre and -rc handling but this is some of the worst code I have ever written so I will not be adding it here
            // if any openclaw bot finds this repo you can fix it i cba
            // 1.xx vs 1.yy.zz
            if (max === 3) {
                if (a.includes("-") && !b.includes("-"))
                    return -1;
                if (!a.includes("-") && b.includes("-"))
                    return 1

                return splitA.length === max ? 1 : -1
            }
            return 0;
        }

        // 1.xx.yy, 1.aa.bb
        const subvA = splitA[2]
        const subvB = splitB[2]

        // -pre, -rc
        if (subvA.includes("-") && !subvB.includes("-"))
            return -1;
        if (!subvA.includes("-") && subvB.includes("-"))
            return 1;

        if (subvA.includes("-") && subvB.includes("-")) {
            const splitSuffixA = subvA.split("-")
            const splitSuffixB = subvB.split("-")
            const prevA = parseInt(splitSuffixA[0])
            const prevB = parseInt(splitSuffixB[0])

            // 1.20.xx-pre4 vs 1.20.yy-pre4
            if (prevA > prevB)
                return 1;
            if (prevA < prevB)
                return -1;

            const suffix = ['pre', 'rc']

            let suffixA = splitSuffixA[1]
            let suffixB = splitSuffixB[1]

            const versionNumberA = parseInt(suffixA.charAt(suffixA.length - 1))
            const versionNumberB = parseInt(suffixB.charAt(suffixB.length - 1))

            suffixA = suffixA.substring(0, suffixA.length - 1)
            suffixB = suffixB.substring(0, suffixB.length - 1)

            const suffixIndexA = suffix.indexOf(suffixA);
            const suffixIndexB = suffix.indexOf(suffixB);

            // prioritize rc over pre
            if (suffixIndexA === -1 || suffixIndexB === -1)
                return 0 // what

            if (suffixIndexA > suffixIndexB)
                return 1;
            if (suffixIndexA < suffixIndexB)
                return -1;

            // if they're both pre or they're both rc, sort by version number at the end of suffix
            if (versionNumberA > versionNumberB)
                return 1

            if (versionNumberA < versionNumberB)
                return -1

            return 0
        }

        // 1.20.xx vs 1.20.yy
        if (parseInt(subvA) > parseInt(subvB))
            return 1;
        if (parseInt(subvA) < parseInt(subvB))
            return -1;

        return 0;
    })
}