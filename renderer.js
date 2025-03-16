window.electron.onUpdateReady((version) => {
    alert("Test Alert!");

    if (Notification.permission === "granted") {
        const notification = new Notification("Update Ready", {
            body: `A new update (v${version}) is ready to install. Restarting in 20s!`,
        });

        // Optionally, allow manual update on click
        notification.onclick = () => {
            window.electron.installUpdate();
        };
    } else {
        alert(`A new update (v${version}) is ready to install. Restarting in 20s!`);
    }
});

// Request notification permission on page load
if (Notification.permission !== "granted") {
    Notification.requestPermission();
}