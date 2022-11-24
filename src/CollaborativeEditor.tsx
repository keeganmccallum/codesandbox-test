import React from "react";
import { useParams } from "react-router-dom";

import { Slate, Editable, useEditor, RenderElementProps } from "slate-react";

import { AppBar, makeStyles, Avatar } from "@material-ui/core";
import { AvatarGroup } from "@material-ui/lab";

import { createEditor, Node, Transforms } from "slate";
import { withHistory } from "slate-history";
import { withReact } from "slate-react";
import {
  SyncElement,
  toSharedType,
  useCursors,
  withCursor,
  withYjs
} from "slate-yjs";

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";

import randomColor from "randomcolor";
import faker from "faker";

interface CollaborativeEditorPathParams {
  documentId: string;
}

const Element: React.FC<any> = ({ attributes, children, element }) => {
  // TODO: Switch element.type
  return <p {...attributes}>{children}</p>;
};

const useStyles = makeStyles((theme) => ({
  editorRoot: {
    width: "100vw",
    minHeight: "100vh"
  },
  peerAvatars: {
    position: "absolute",
    top: theme.spacing(2),
    right: theme.spacing(2)
  }
}));

interface InitialGlobals {
  doc: Y.Doc;
  webRtcProvider: WebrtcProvider;
  sharedType: Y.Array<SyncElement>;
  indexdbProvider: IndexeddbPersistence;
}

interface PeerState {
  alphaColor: string;
  color: string;
  name: string;
  photoUrl: string;
}

export const CollaborativeEditor: React.FC = () => {
  const { documentId } = useParams<CollaborativeEditorPathParams>();
  const classes = useStyles();

  const [isOnline, setOnlineState] = React.useState(false);
  const [value, setValue] = React.useState<Array<Node>>([]);

  const [peers, setPeers] = React.useState<Array<PeerState & { id: number }>>(
    {}
  );

  const localState = React.useMemo<PeerState>(() => {
    const color = randomColor({
      luminosity: "dark",
      format: "rgba",
      alpha: 1
    });

    const gender = faker.random.boolean() ? "male" : "female";
    console.dir({ gender });
    const photoIndex = faker.random.number(94);

    // @ts-ignore
    const name = faker.name.findName(undefined, undefined, gender);
    const photoUrl = `https://randomuser.me/api/portraits/${
      gender === "male" ? "men" : "women"
    }/${photoIndex}.jpg`;

    return { color, name, photoUrl, alphaColor: color.slice(0, -2) + "0.2)" };
  }, []);

  const { sharedType, webRtcProvider, doc } = React.useMemo<
    InitialGlobals
  >(() => {
    const doc = new Y.Doc();

    const indexdbProvider = new IndexeddbPersistence(documentId, doc);
    const webRtcProvider = new WebrtcProvider(documentId, doc);

    const sharedType = doc.getArray<SyncElement>("content");

    return { sharedType, webRtcProvider, indexdbProvider, doc };
  }, [documentId]);

  React.useEffect(() => {
    return () => {
      doc?.destroy();
    };
  }, [doc]);

  const editor = React.useMemo(
    () =>
      withCursor(
        withYjs(withReact(withHistory(createEditor())), sharedType),
        webRtcProvider.awareness
      ),
    [sharedType, webRtcProvider]
  );

  React.useEffect(() => {
    webRtcProvider.on("status", (props: { status: string }) => {
      console.dir(props);
      setOnlineState(props.status === "connected");
    });

    webRtcProvider.on("sync", (synched: boolean) => {
      console.info(`synced: ${synched}`);
      if (synched && sharedType.length === 0) {
        toSharedType(sharedType, [
          { type: "paragraph", children: [{ text: "New Value!" }] }
        ]);
      }
    });

    webRtcProvider.awareness.setLocalState(localState);

    webRtcProvider.awareness.on(
      "update",
      ({
        added,
        updated,
        removed
      }: {
        added: Array<number>;
        updated: Array<number>;
        removed: Array<number>;
      }) => {
        const states = webRtcProvider.awareness.getStates() as Map<
          number,
          PeerState
        >;
        setPeers((peers) => {
          const allUpdatedIds = [...updated, ...added];
          const newPeers = [];

          for (const peer in peers) {
            if ([...removed, ...allUpdatedIds].some((id) => peer.id === id))
              continue;

            newPeers.push(peer);
          }

          for (const id of allUpdatedIds) {
            const peerState = states.get(id);
            if (peerState) {
              newPeers.push({
                id,
                ...peerState
              });
            }
          }

          return newPeers.sort((a, b) => a.id - b.id);
        });
      }
    );

    console.info(`Connecting...`);
    webRtcProvider.connect();

    return () => {
      console.info(`Disconnecting`);
      webRtcProvider.disconnect();
    };
  }, [webRtcProvider, editor]);

  const { decorate } = useCursors(editor);

  const renderElement = (props: RenderElementProps) => <Element {...props} />;

  return (
    <Slate
      className={classes.editorRoot}
      editor={editor}
      value={value}
      onChange={setValue}
    >
      <AppBar title={documentId} position="fixed"></AppBar>
      <Editable renderElement={renderElement} decorate={decorate} />

      {Object.keys(peers).length > 0 && (
        <AvatarGroup className={classes.peerAvatars}>
          peers.map((peer) => <PeerAvatar peer={peer} key={peer.id} />)
        </AvatarGroup>
      )}
    </Slate>
  );
};

interface PeerAvatarProps {
  peer: PeerState;
}

const PeerAvatar: React.FC<PeerAvatarProps> = (props) => {
  const { name, color, photoUrl } = props.peer;

  return (
    <Avatar
      alt={name}
      src={photoUrl}
      style={{ border: `${color} 3px solid` }}
    />
  );
};
