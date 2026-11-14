import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkDepositSection from "./WorkDepositSection";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), create: vi.fn(), error: vi.fn() }));
vi.mock("@/hooks/useLmsWorkDeposit", () => ({
  useMyDeposits: () => ({ data: [], isLoading: false }),
  useVisibleDeposits: () => ({ data: [] }),
  useCreateDeposit: () => ({ isPending: false, mutateAsync: mocks.create }),
  useUpdateDeposit: () => ({ isPending: false }),
  useDeleteDeposit: () => ({ isPending: false }),
  uploadDepositFile: mocks.upload,
}));
vi.mock("@/hooks/useLearnerProfile", () => ({ useLearnerProfile: () => ({ data: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/toastError", () => ({ toastError: mocks.error }));
vi.mock("./DepositCommentList", () => ({ default: () => null }));
vi.mock("./DepositFeedbackList", () => ({ default: () => null }));
vi.mock("./DepositFilePreview", () => ({ default: () => null }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("dépôt en cours et fichier conservé", () => {
  it("refuse MKV dès la sélection sans upload ni erreur remontée à Sentry", () => {
    const { container } = render(<WorkDepositSection lessonId="l1" courseId="c1" moduleId={null} learnerEmail="test@example.test" lessonTitle="Exercice" rawConfig={{}} />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Fichier absent");
    fireEvent.change(input, { target: { files: [new File(["video"], "video.mkv", { type: "video/matroska" })] } });
    expect(screen.getByRole("button", { name: "Envoyer mon travail" })).toBeDisabled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("bloque un second envoi pendant l'upload et renvoie le fichier conservé après l'échec", async () => {
    let fail: ((error: Error) => void) | undefined;
    mocks.upload.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    const { container } = render(<WorkDepositSection lessonId="l1" courseId="c1" moduleId={null} learnerEmail="test@example.test" lessonTitle="Exercice" rawConfig={{}} />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Fichier absent");
    const file = new File(["dessin"], "dessin.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(screen.getByPlaceholderText(/Ajoutez un mot/), { target: { value: "Mon travail" } });
    const send = screen.getByRole("button", { name: "Envoyer mon travail" });
    fireEvent.click(send);
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    if (!fail) throw new Error("Envoi non démarré");
    fail(new Error("aucune réponse"));
    await waitFor(() => expect(send).not.toBeDisabled());
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Ajoutez un mot/)).toHaveValue("Mon travail");
    mocks.upload.mockResolvedValueOnce({ url: "https://example.test/dessin.png", name: file.name, size: file.size, mime: "image/png" });
    mocks.create.mockResolvedValueOnce({ id: "deposit" });
    fireEvent.click(send);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ file_name: "dessin.png", comment: "Mon travail" })));
    expect(mocks.upload.mock.calls[1][0]).toBe(file);
    await waitFor(() => expect(send).toBeDisabled());
  });
});