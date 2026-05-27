import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockToast = vi.fn();

const { mockFetchConventionSignature, mockUploadSignedConvention, mockDeleteSignedConvention, mockResolveContentType } =
  vi.hoisted(() => ({
    mockFetchConventionSignature: vi.fn(),
    mockUploadSignedConvention: vi.fn(),
    mockDeleteSignedConvention: vi.fn(),
    mockResolveContentType: vi.fn(),
  }));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/services/participants", () => ({
  fetchConventionSignature: mockFetchConventionSignature,
  uploadSignedConvention: mockUploadSignedConvention,
  deleteSignedConvention: mockDeleteSignedConvention,
}));
vi.mock("@/lib/file-utils", () => ({ resolveContentType: mockResolveContentType }));

import { useParticipantConvention } from "./useParticipantConvention";
import type { UseParticipantConventionOptions } from "./useParticipantConvention";

function makeFile(name = "convention.pdf", type = "application/pdf"): File {
  return new File(["content"], name, { type });
}

function makeChangeEvent(file: File | null): React.ChangeEvent<HTMLInputElement> {
  return {
    target: { files: file ? [file] : null } as unknown as HTMLInputElement,
  } as React.ChangeEvent<HTMLInputElement>;
}

const baseOptions: UseParticipantConventionOptions = {
  participantId: "part-1",
  trainingId: "training-1",
  open: true,
  isInterEntreprise: false,
  sponsorEmail: null,
  initialSignedConventionUrl: null,
  onParticipantUpdated: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchConventionSignature.mockResolvedValue(null);
  mockUploadSignedConvention.mockResolvedValue("https://example.com/convention.pdf");
  mockDeleteSignedConvention.mockResolvedValue(undefined);
  mockResolveContentType.mockReturnValue("application/pdf");
  (baseOptions.onParticipantUpdated as ReturnType<typeof vi.fn>).mockReset?.();
});

describe("useParticipantConvention — initial state", () => {
  it("reflects initialSignedConventionUrl as signedConventionUrl", () => {
    const { result } = renderHook(() =>
      useParticipantConvention({ ...baseOptions, initialSignedConventionUrl: "https://cdn.test/file.pdf" }),
    );
    expect(result.current.signedConventionUrl).toBe("https://cdn.test/file.pdf");
  });

  it("starts with uploadingConvention false and conventionSignature null", () => {
    const { result } = renderHook(() => useParticipantConvention(baseOptions));
    expect(result.current.uploadingConvention).toBe(false);
    expect(result.current.conventionSignature).toBeNull();
  });
});

describe("useParticipantConvention — signedConventionUrl sync", () => {
  it("resets to new initialSignedConventionUrl when prop changes on rerender", () => {
    const { result, rerender } = renderHook(
      (props: UseParticipantConventionOptions) => useParticipantConvention(props),
      { initialProps: { ...baseOptions, initialSignedConventionUrl: "https://cdn.test/old.pdf" } },
    );
    expect(result.current.signedConventionUrl).toBe("https://cdn.test/old.pdf");

    rerender({ ...baseOptions, initialSignedConventionUrl: "https://cdn.test/new.pdf" });
    expect(result.current.signedConventionUrl).toBe("https://cdn.test/new.pdf");
  });
});

describe("useParticipantConvention — fetchConventionSignature", () => {
  it("calls fetchConventionSignature and populates conventionSignature when conditions are met", async () => {
    const signature = { status: "signed", signedAt: "2026-01-01" };
    mockFetchConventionSignature.mockResolvedValue(signature);

    const { result } = renderHook(() =>
      useParticipantConvention({
        ...baseOptions,
        open: true,
        isInterEntreprise: true,
        sponsorEmail: "sponsor@example.com",
      }),
    );

    await waitFor(() => expect(result.current.conventionSignature).toEqual(signature));
    expect(mockFetchConventionSignature).toHaveBeenCalledWith("training-1", "sponsor@example.com");
  });

  it("does NOT call fetchConventionSignature when open is false", () => {
    renderHook(() =>
      useParticipantConvention({
        ...baseOptions,
        open: false,
        isInterEntreprise: true,
        sponsorEmail: "sponsor@example.com",
      }),
    );
    expect(mockFetchConventionSignature).not.toHaveBeenCalled();
  });

  it("does NOT call fetchConventionSignature when isInterEntreprise is false", () => {
    renderHook(() =>
      useParticipantConvention({
        ...baseOptions,
        open: true,
        isInterEntreprise: false,
        sponsorEmail: "sponsor@example.com",
      }),
    );
    expect(mockFetchConventionSignature).not.toHaveBeenCalled();
  });

  it("does NOT call fetchConventionSignature when sponsorEmail is null", () => {
    renderHook(() =>
      useParticipantConvention({
        ...baseOptions,
        open: true,
        isInterEntreprise: true,
        sponsorEmail: null,
      }),
    );
    expect(mockFetchConventionSignature).not.toHaveBeenCalled();
  });
});

describe("useParticipantConvention — handleConventionUpload", () => {
  it("does nothing when no file is provided", async () => {
    const { result } = renderHook(() => useParticipantConvention(baseOptions));
    await act(async () => {
      await result.current.handleConventionUpload(makeChangeEvent(null));
    });
    expect(mockUploadSignedConvention).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("shows destructive toast and does not upload when file is not PDF", async () => {
    mockResolveContentType.mockReturnValue("image/png");
    const { result } = renderHook(() => useParticipantConvention(baseOptions));
    await act(async () => {
      await result.current.handleConventionUpload(makeChangeEvent(makeFile("photo.png", "image/png")));
    });
    expect(mockUploadSignedConvention).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Format non supporté" }),
    );
  });

  it("uploads PDF, sets URL, calls onParticipantUpdated, shows success toast", async () => {
    const onParticipantUpdated = vi.fn();
    const { result } = renderHook(() =>
      useParticipantConvention({ ...baseOptions, onParticipantUpdated }),
    );
    await act(async () => {
      await result.current.handleConventionUpload(makeChangeEvent(makeFile()));
    });
    expect(mockUploadSignedConvention).toHaveBeenCalledWith("training-1", "part-1", expect.any(File));
    expect(result.current.signedConventionUrl).toBe("https://example.com/convention.pdf");
    expect(onParticipantUpdated).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Convention uploadée" }));
  });

  it("shows error toast and resets uploadingConvention to false on upload failure", async () => {
    mockUploadSignedConvention.mockRejectedValue(new Error("Storage quota exceeded"));
    const { result } = renderHook(() => useParticipantConvention(baseOptions));
    await act(async () => {
      await result.current.handleConventionUpload(makeChangeEvent(makeFile()));
    });
    expect(result.current.uploadingConvention).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Erreur d'upload", description: "Storage quota exceeded" }),
    );
  });
});

describe("useParticipantConvention — handleConventionDelete", () => {
  it("does nothing when signedConventionUrl is null", async () => {
    const { result } = renderHook(() =>
      useParticipantConvention({ ...baseOptions, initialSignedConventionUrl: null }),
    );
    await act(async () => {
      await result.current.handleConventionDelete();
    });
    expect(mockDeleteSignedConvention).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("deletes convention, sets URL to null, calls onParticipantUpdated, shows success toast", async () => {
    const onParticipantUpdated = vi.fn();
    const { result } = renderHook(() =>
      useParticipantConvention({
        ...baseOptions,
        initialSignedConventionUrl: "https://cdn.test/conv.pdf",
        onParticipantUpdated,
      }),
    );
    await act(async () => {
      await result.current.handleConventionDelete();
    });
    expect(mockDeleteSignedConvention).toHaveBeenCalledWith("part-1", "https://cdn.test/conv.pdf");
    expect(result.current.signedConventionUrl).toBeNull();
    expect(onParticipantUpdated).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Convention supprimée" }));
  });

  it("shows error toast when delete fails", async () => {
    mockDeleteSignedConvention.mockRejectedValue(new Error("RLS violation"));
    const { result } = renderHook(() =>
      useParticipantConvention({
        ...baseOptions,
        initialSignedConventionUrl: "https://cdn.test/conv.pdf",
      }),
    );
    await act(async () => {
      await result.current.handleConventionDelete();
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Erreur" }),
    );
  });
});
