import { useState, useEffect } from "react";
import { Box } from "ink";
import { Header, Row, Section } from "../../utils/ui/theme/index.js";
import { DependencyList } from "./DependencyList.js";
import { QrLogin } from "./QrLogin.js";
import { AccountSetup } from "./AccountSetup.js";
import { computeAllDone } from "./completion.js";
import { VERSION_LABEL } from "../../utils/version.js";
import type { LoginHandle } from "../../utils/auth.js";

export function InitScreen({
    login,
    existingAddress,
    onDone,
}: {
    login: LoginHandle | null;
    existingAddress: string | null;
    onDone: () => void;
}) {
    const needsQr = login !== null;
    const [loggedInAddress, setLoggedInAddress] = useState<string | null>(existingAddress);
    const [authResolved, setAuthResolved] = useState(!needsQr);
    const [depsComplete, setDepsComplete] = useState(false);
    const [accountComplete, setAccountComplete] = useState(false);
    const [accountOk, setAccountOk] = useState(true);

    const allDone = computeAllDone({
        needsQr,
        authResolved,
        loggedInAddress,
        depsComplete,
        accountComplete,
    });

    const handleDepsDone = () => {
        setDepsComplete(true);
    };

    const handleAuthDone = (address: string | null) => {
        if (address) setLoggedInAddress(address);
        setAuthResolved(true);
    };

    const handleAccountDone = (success: boolean) => {
        setAccountOk(success);
        setAccountComplete(true);
    };

    useEffect(() => {
        if (allDone) onDone();
    }, [allDone]);

    return (
        <Box flexDirection="column">
            <Header
                cmd="dot init"
                subtitle="polkadot playground"
                network="paseo"
                right={VERSION_LABEL}
            />

            {needsQr && <QrLogin login={login} onDone={handleAuthDone} />}
            {!needsQr && existingAddress && (
                <Section>
                    <Row mark="ok" label="logged in" value={existingAddress} tone="muted" />
                </Section>
            )}

            <DependencyList onDone={handleDepsDone} />

            {loggedInAddress && depsComplete && (
                <AccountSetup address={loggedInAddress} onDone={handleAccountDone} />
            )}

            {allDone && (
                <Section gapBelow={false}>
                    <Row
                        mark="ok"
                        label="setup complete"
                        value={accountOk ? undefined : "some account setup steps failed"}
                        tone={accountOk ? "default" : "warning"}
                    />
                </Section>
            )}
        </Box>
    );
}
