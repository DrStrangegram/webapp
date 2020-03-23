// Send message form.
import React, { useState, useEffect } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import { IconButton, Fab, InputBase, Box, Paper } from '@material-ui/core';
import { Photo, AttachFile, Send } from '@material-ui/icons';
import { makeStyles } from '@material-ui/styles';
import { Drafty } from 'tinode-sdk';

import { KEYPRESS_DELAY, MAX_EXTERN_ATTACHMENT_SIZE, MAX_IMAGE_DIM, MAX_INBAND_ATTACHMENT_SIZE } from '../config.js';
import { SUPPORTED_IMAGE_FORMATS, filePasted, fileToBase64, imageFileToBase64, imageFileScaledToBase64 } from '../lib/blob-helpers.js';
import { bytesToHumanSize } from '../lib/strformat.js';

const messages = defineMessages({
  'messaging_disabled': {
    id: 'messaging_disabled_prompt',
    defaultMessage: 'Messaging disabled',
    description: 'Prompt in SendMessage in read-only topic'
  },
  'type_new_message': {
    id: 'new_message_prompt',
    defaultMessage: 'New message',
    description: 'Prompt in SendMessage in read-only topic'
  },
  'file_attachment_too_large': {
    id: 'file_attachment_too_large',
    defaultMessage: 'The file size {size} exceeds the {limit} limit.',
    description: 'Error message when attachment is too large'
  },
  'cannot_initiate_upload': {
    id: 'cannot_initiate_file_upload',
    defaultMessage: 'Cannot initiate file upload.',
    description: 'Generic error messagewhen attachment fails'
  },
});

const useStyles = makeStyles(theme => ({
  root: {
    flex: 1,
    display: 'flex',
    padding: 8,
    color: 'transparent'
  },
  messageBox: {
    flex: 1,
    display: 'flex',
    backgroundColor: 'white',
    borderRadius: 22,
    paddingLeft: 16,
    marginRight: 8
  },
  input: {
    flex: 1
  },
  aButtonContainer: {
    position: 'relative',
    width: 44,
    minHeight: 44
  },
  sendContainer: {
    position: 'relative',
    width: 40
  },
  button: {
    position: 'absolute',
    bottom: 0
  }
}));


const SendMessage = (props) => {  
  //States
  const [message, setMessage] = useState('');
  const [keypressTimestamp, setKeypressTimestamp] = useState(new Date().getTime() - KEYPRESS_DELAY - 1);
  
  //Refs
  const messageEditArea = React.createRef();
  var attachFile, attachImage;
  
  const classes = useStyles();
  const {formatMessage} = props.intl;
  const prompt = formatMessage(props.disabled ? messages.messaging_disabled : messages.type_new_message);

  const _handleSend = (e) => {
    const msg = message.trim();

    if (msg) {
      props.sendMessage(msg);
      setMessage('');
    }
  };

  const _handleKeyPress = (e) => {
    if (e.key === 'Enter') { // Remove this if you don't want Enter to trigger send
      if (!e.shiftKey) { // Have Shift-Enter insert a line break instead
        e.preventDefault();
        e.stopPropagation();

        _handleSend(e);
      }
    }
  };

  const _handlePasteEvent = (e) => {
    if (!props.disabled) {
      // FIXME: handle large files too.
      if (filePasted(e, (bits, mime, width, height, fname) => {
          props.sendMessage(Drafty.insertImage(null,
            0, mime, bits, width, height, fname));
        },
        (mime, bits, fname) => {
          props.sendMessage(Drafty.attachFile(null, mime, bits, fname));
        },
        props.onError)) {
  
        // If a file was pasted, don't paste base64 data into input field.
        e.preventDefault();
      }
    } 
  };

  const _handleMessageTyping = (e) => {
    const now = new Date().getTime();

    if (now - keypressTimestamp > KEYPRESS_DELAY) {
      const topic = props.tinode.getTopic(props.topic);
      
      if (topic.isSubscribed()) {
        topic.noteKeyPress();
      }
      setKeypressTimestamp(now);
    }

    setMessage(e.target.value);
  };

  const _handleAttachImage = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Check if the uploaded file is indeed an image and if it isn't too large.
      if (file.size > MAX_INBAND_ATTACHMENT_SIZE || SUPPORTED_IMAGE_FORMATS.indexOf(file.type) < 0) {
        // Convert image for size or format.
        imageFileScaledToBase64(file, MAX_IMAGE_DIM, MAX_IMAGE_DIM, false,
          // Success
          (bits, mime, width, height, fname) => {
            props.sendMessage(Drafty.insertImage(null, 0, mime, bits, width, height, fname));
          },
          // Failure
          (err) => {
            props.onError(err, 'err');
          });
      } else {
        // Image can be uploaded as is. No conversion is needed.
        imageFileToBase64(file,
          // Success
          (bits, mime, width, height, fname) => {
            props.sendMessage(Drafty.insertImage(null, 0, mime, bits, width, height, fname));
          },
          // Failure
          (err) => {
            props.onError(err, 'err');
          }
        );
      }
    }
    // Clear the value so the same file can be uploaded again.
    e.target.value = '';
  };

  const _handleAttachFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      if (file.size > MAX_EXTERN_ATTACHMENT_SIZE) { // Too large.
        props.onError(formatMessage(messages.file_attachment_too_large, { size: bytesToHumanSize(file.size), limit: bytesToHumanSize(MAX_EXTERN_ATTACHMENT_SIZE)}), 'err');
      } else if (file.size > MAX_INBAND_ATTACHMENT_SIZE) { // Too large to send inband - uploading out of band and sending as a link.
        const uploader = props.tinode.getLargeFileHelper();

        if (!uploader) {
          props.onError(formatMessage(messages.cannot_initiate_upload));
          return;
        }
        // Format data and initiate upload.
        const uploadCompletionPromise = uploader.upload(file);
        const msg = Drafty.attachFile(null, file.type, null, file.name, file.size, uploadCompletionPromise);

        // Pass data and the uploader to the TinodeWeb.
        props.sendMessage(msg, uploadCompletionPromise, uploader);
      } else { // Small enough to send inband.
        fileToBase64(file,
          (mime, bits, fname) => {
            props.sendMessage(Drafty.attachFile(null, mime, bits, fname));
          },
          props.onError
        );
      }
    }
    // Clear the value so the same file can be uploaded again.
    e.target.value = '';
  };

  useEffect(() => {
    const msgEdit = messageEditArea.current;
    
    msgEdit.addEventListener('paste', _handlePasteEvent, false);
    msgEdit.addEventListener('keypress', _handleKeyPress, false);

    return function cleanup() {
      msgEdit.removeEventListener('paste', _handlePasteEvent, false);
      msgEdit.removeEventListener('keypress', _handleKeyPress, false);
    };
  });

  return (
    <Box className={classes.root}>
      <Paper className={classes.messageBox}>
        <InputBase className={classes.input} multiline id="sendMessage" inputRef={messageEditArea} placeholder={prompt} value={message} onChange={_handleMessageTyping}/>
        <Box className={classes.aButtonContainer}>
          <IconButton className={classes.button} disabled={props.disabled} onClick={(e) => {attachImage.click();}}><Photo /></IconButton>
        </Box>
        <Box className={classes.aButtonContainer}>
          <IconButton className={classes.button} disabled={props.button} onClick={(e) => {attachFile.click();}}><AttachFile /></IconButton>
        </Box>
        <input type="file" ref={(ref) => {attachFile = ref;}} onChange={_handleAttachFile} style={{display: 'none'}} />
        <input type="file" ref={(ref) => {attachImage = ref;}} accept="image/*" onChange={_handleAttachImage} style={{display: 'none'}} />
      </Paper>
      <Box className={classes.sendContainer}>
        <Fab className={classes.button} size="small" color="primary" aria-label="add" disabled={props.disabled} onClick={_handleSend}>
          <Send />
        </Fab>
      </Box>
    </Box>
  );
}

export default injectIntl(SendMessage); 